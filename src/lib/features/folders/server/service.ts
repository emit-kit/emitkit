import { auth } from '$lib/server/auth';
import * as folderRepo from './repository';
import type { Folder } from '$lib/server/db/schema';
import type { FolderCreateInput, FolderUpdateInput } from '../validators';
import type { FolderCreateResponse } from '../types';
import { db } from '$lib/server/db';
import { apikey, channel } from '$lib/server/db/schema';
import { sql, eq } from 'drizzle-orm';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('folders-service');

export async function createFolderWithApiKey(
	input: FolderCreateInput,
	userId: string
): Promise<FolderCreateResponse> {
	// Check if slug is available
	const slugAvailable = await folderRepo.isSlugAvailable(input.organizationId, input.slug);
	if (!slugAvailable) {
		const error = new Error('A folder with this slug already exists in your organization');
		logger.error('Folder creation failed: slug already exists', error, {
			organizationId: input.organizationId,
			slug: input.slug,
			userId
		});
		throw error;
	}

	// Create the folder
	const folder = await folderRepo.createFolder({
		organizationId: input.organizationId,
		name: input.name,
		slug: input.slug,
		url: input.url,
		icon: input.icon,
		description: input.description
	});

	// Create API key with Better Auth
	const apiKey = await auth.api.createApiKey({
		body: {
			name: `${folder.name} API Key`,
			userId,
			metadata: {
				folderId: folder.id,
				orgId: input.organizationId, // Note: using orgId to match middleware expectations
				folderName: folder.name
			},
			// No expiration by default
			expiresIn: undefined,
			// Use default rate limits from plugin config
			rateLimitEnabled: true
		}
	});

	if (!apiKey) {
		// Rollback: hard delete the folder if API key creation failed
		await folderRepo.hardDeleteFolder(folder.id, input.organizationId);
		const error = new Error('Failed to create API key for folder');
		logger.error('API key creation failed for folder, rolled back folder creation', error, {
			folderId: folder.id,
			organizationId: input.organizationId,
			userId
		});
		throw error;
	}

	logger.info('Folder created with API key', {
		folderId: folder.id,
		organizationId: folder.organizationId,
		name: folder.name,
		slug: folder.slug,
		apiKeyId: apiKey.id,
		userId
	});

	return {
		folder,
		apiKey: {
			id: apiKey.id,
			key: apiKey.key, // Full key only returned here!
			start: apiKey.start,
			name: apiKey.name
		}
	};
}

export async function getFolder(folderId: string, orgId: string): Promise<Folder | null> {
	return await folderRepo.getFolderByIdAndOrg(folderId, orgId);
}

export async function updateFolder(
	folderId: string,
	orgId: string,
	input: FolderUpdateInput
): Promise<Folder> {
	// Verify ownership
	const existing = await folderRepo.getFolderByIdAndOrg(folderId, orgId);
	if (!existing) {
		throw new Error('Folder not found or access denied');
	}

	// If slug is being changed, verify it's available
	if (input.slug && input.slug !== existing.slug) {
		const slugAvailable = await folderRepo.isSlugAvailable(orgId, input.slug);
		if (!slugAvailable) {
			throw new Error('A folder with this slug already exists in your organization');
		}
	}

	return await folderRepo.updateFolder(folderId, input);
}

export async function deleteFolder(folderId: string, orgId: string): Promise<void> {
	const operation = logger.start('Soft delete folder', { folderId, organizationId: orgId });

	try {
		// Verify ownership (include deleted folders to prevent access if already deleted)
		const existing = await folderRepo.getFolderByIdAndOrg(folderId, orgId, false);
		if (!existing) {
			const error = new Error('Folder not found or access denied');
			logger.error('Folder deletion failed: not found or access denied', error, { folderId, orgId });
			throw error;
		}

		operation.step('Soft deleting associated channels');
		// Soft delete all channels associated with the folder
		await db
			.update(channel)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(channel.folderId, folderId));

		operation.step('Disabling API keys');
		// Disable all API keys associated with the folder
		const disabledKeys = await db
			.update(apikey)
			.set({
				enabled: false,
				updatedAt: new Date()
			})
			.where(sql`${apikey.metadata}->>'folderId' = ${folderId}`)
			.returning();

		operation.step('Soft deleting folder');
		// Soft delete the folder by setting deletedAt timestamp
		await folderRepo.softDeleteFolder(folderId);

		operation.end({
			folderId,
			organizationId: orgId,
			folderName: existing.name,
			disabledApiKeys: disabledKeys.length
		});

		// IMPORTANT: Soft delete behavior
		// - Folder is marked as deleted (deletedAt timestamp set)
		// - Channels are soft deleted (can be restored)
		// - API keys are disabled (prevents unauthorized access)
		// - Events and identity data in Tinybird are NOT affected
		// - Data can be fully restored within retention period
		// - After retention period, a cleanup job should hard delete old soft-deleted folders

		logger.success('Folder soft deleted successfully', {
			folderId,
			organizationId: orgId,
			folderName: existing.name,
			disabledApiKeys: disabledKeys.length,
			note: 'Folder can be restored within retention period'
		});
	} catch (error) {
		operation.error('Failed to soft delete folder', error instanceof Error ? error : undefined, {
			folderId,
			organizationId: orgId
		});
		throw error;
	}
}

export async function restoreFolder(folderId: string, orgId: string): Promise<void> {
	const operation = logger.start('Restore folder', { folderId, organizationId: orgId });

	try {
		// Verify ownership (include deleted folders since we're restoring)
		const existing = await folderRepo.getFolderByIdAndOrg(folderId, orgId, true);
		if (!existing) {
			const error = new Error('Folder not found or access denied');
			logger.error('Folder restore failed: not found or access denied', error, { folderId, orgId });
			throw error;
		}

		// Check if folder is actually deleted
		if (!existing.deletedAt) {
			const error = new Error('Folder is not deleted');
			logger.error('Folder restore failed: folder is not deleted', error, { folderId, orgId });
			throw error;
		}

		operation.step('Restoring folder');
		// Restore the folder by clearing deletedAt timestamp
		await folderRepo.restoreFolder(folderId);

		operation.step('Restoring associated channels');
		// Restore all channels associated with the folder
		await db
			.update(channel)
			.set({
				deletedAt: null,
				updatedAt: new Date()
			})
			.where(eq(channel.folderId, folderId));

		operation.step('Re-enabling API keys');
		// Re-enable all API keys associated with the folder
		const enabledKeys = await db
			.update(apikey)
			.set({
				enabled: true,
				updatedAt: new Date()
			})
			.where(sql`${apikey.metadata}->>'folderId' = ${folderId}`)
			.returning();

		operation.end({
			folderId,
			organizationId: orgId,
			folderName: existing.name,
			enabledApiKeys: enabledKeys.length
		});

		logger.success('Folder restored successfully', {
			folderId,
			organizationId: orgId,
			folderName: existing.name,
			enabledApiKeys: enabledKeys.length
		});
	} catch (error) {
		operation.error('Failed to restore folder', error instanceof Error ? error : undefined, {
			folderId,
			organizationId: orgId
		});
		throw error;
	}
}
