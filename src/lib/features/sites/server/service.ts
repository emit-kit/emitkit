import { auth } from '$lib/server/auth';
import * as siteRepo from './repository';
import type { Site } from '$lib/server/db/schema';
import type { SiteCreateInput, SiteUpdateInput } from '../validators';
import type { SiteCreateResponse } from '../types';
import { db } from '$lib/server/db';
import { apikey, channel } from '$lib/server/db/schema';
import { sql, eq } from 'drizzle-orm';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('sites-service');

export async function createSiteWithApiKey(
	input: SiteCreateInput,
	userId: string
): Promise<SiteCreateResponse> {
	// Check if slug is available
	const slugAvailable = await siteRepo.isSlugAvailable(input.organizationId, input.slug);
	if (!slugAvailable) {
		const error = new Error('A site with this slug already exists in your organization');
		logger.error('Site creation failed: slug already exists', error, {
			organizationId: input.organizationId,
			slug: input.slug,
			userId
		});
		throw error;
	}

	// Create the site
	const site = await siteRepo.createSite({
		organizationId: input.organizationId,
		name: input.name,
		slug: input.slug,
		icon: input.icon,
		description: input.description
	});

	// Create API key with Better Auth
	const apiKey = await auth.api.createApiKey({
		body: {
			name: `${site.name} API Key`,
			userId,
			metadata: {
				siteId: site.id,
				orgId: input.organizationId, // Note: using orgId to match middleware expectations
				siteName: site.name
			},
			// No expiration by default
			expiresIn: undefined,
			// Use default rate limits from plugin config
			rateLimitEnabled: true
		}
	});

	if (!apiKey) {
		// Rollback: hard delete the site if API key creation failed
		await siteRepo.hardDeleteSite(site.id, input.organizationId);
		const error = new Error('Failed to create API key for site');
		logger.error('API key creation failed for site, rolled back site creation', error, {
			siteId: site.id,
			organizationId: input.organizationId,
			userId
		});
		throw error;
	}

	logger.info('Site created with API key', {
		siteId: site.id,
		organizationId: site.organizationId,
		name: site.name,
		slug: site.slug,
		apiKeyId: apiKey.id,
		userId
	});

	return {
		site,
		apiKey: {
			id: apiKey.id,
			key: apiKey.key, // Full key only returned here!
			start: apiKey.start,
			name: apiKey.name
		}
	};
}

export async function getSite(siteId: string, orgId: string): Promise<Site | null> {
	return await siteRepo.getSiteByIdAndOrg(siteId, orgId);
}

export async function updateSite(
	siteId: string,
	orgId: string,
	input: SiteUpdateInput
): Promise<Site> {
	// Verify ownership
	const existing = await siteRepo.getSiteByIdAndOrg(siteId, orgId);
	if (!existing) {
		throw new Error('Site not found or access denied');
	}

	// If slug is being changed, verify it's available
	if (input.slug && input.slug !== existing.slug) {
		const slugAvailable = await siteRepo.isSlugAvailable(orgId, input.slug);
		if (!slugAvailable) {
			throw new Error('A site with this slug already exists in your organization');
		}
	}

	return await siteRepo.updateSite(siteId, input);
}

export async function deleteSite(siteId: string, orgId: string): Promise<void> {
	const operation = logger.start('Soft delete site', { siteId, organizationId: orgId });

	try {
		// Verify ownership (include deleted sites to prevent access if already deleted)
		const existing = await siteRepo.getSiteByIdAndOrg(siteId, orgId, false);
		if (!existing) {
			const error = new Error('Site not found or access denied');
			logger.error('Site deletion failed: not found or access denied', error, { siteId, orgId });
			throw error;
		}

		operation.step('Soft deleting associated channels');
		// Soft delete all channels associated with the site
		await db
			.update(channel)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(channel.siteId, siteId));

		operation.step('Disabling API keys');
		// Disable all API keys associated with the site
		const disabledKeys = await db
			.update(apikey)
			.set({
				enabled: false,
				updatedAt: new Date()
			})
			.where(sql`${apikey.metadata}->>'siteId' = ${siteId}`)
			.returning();

		operation.step('Soft deleting site');
		// Soft delete the site by setting deletedAt timestamp
		await siteRepo.softDeleteSite(siteId);

		operation.end({
			siteId,
			organizationId: orgId,
			siteName: existing.name,
			disabledApiKeys: disabledKeys.length
		});

		// IMPORTANT: Soft delete behavior
		// - Site is marked as deleted (deletedAt timestamp set)
		// - Channels are soft deleted (can be restored)
		// - API keys are disabled (prevents unauthorized access)
		// - Events and identity data in Tinybird are NOT affected
		// - Data can be fully restored within retention period
		// - After retention period, a cleanup job should hard delete old soft-deleted sites

		logger.success('Site soft deleted successfully', {
			siteId,
			organizationId: orgId,
			siteName: existing.name,
			disabledApiKeys: disabledKeys.length,
			note: 'Site can be restored within retention period'
		});
	} catch (error) {
		operation.error('Failed to soft delete site', error instanceof Error ? error : undefined, {
			siteId,
			organizationId: orgId
		});
		throw error;
	}
}

export async function restoreSite(siteId: string, orgId: string): Promise<void> {
	const operation = logger.start('Restore site', { siteId, organizationId: orgId });

	try {
		// Verify ownership (include deleted sites since we're restoring)
		const existing = await siteRepo.getSiteByIdAndOrg(siteId, orgId, true);
		if (!existing) {
			const error = new Error('Site not found or access denied');
			logger.error('Site restore failed: not found or access denied', error, { siteId, orgId });
			throw error;
		}

		// Check if site is actually deleted
		if (!existing.deletedAt) {
			const error = new Error('Site is not deleted');
			logger.error('Site restore failed: site is not deleted', error, { siteId, orgId });
			throw error;
		}

		operation.step('Restoring site');
		// Restore the site by clearing deletedAt timestamp
		await siteRepo.restoreSite(siteId);

		operation.step('Restoring associated channels');
		// Restore all channels associated with the site
		await db
			.update(channel)
			.set({
				deletedAt: null,
				updatedAt: new Date()
			})
			.where(eq(channel.siteId, siteId));

		operation.step('Re-enabling API keys');
		// Re-enable all API keys associated with the site
		const enabledKeys = await db
			.update(apikey)
			.set({
				enabled: true,
				updatedAt: new Date()
			})
			.where(sql`${apikey.metadata}->>'siteId' = ${siteId}`)
			.returning();

		operation.end({
			siteId,
			organizationId: orgId,
			siteName: existing.name,
			enabledApiKeys: enabledKeys.length
		});

		logger.success('Site restored successfully', {
			siteId,
			organizationId: orgId,
			siteName: existing.name,
			enabledApiKeys: enabledKeys.length
		});
	} catch (error) {
		operation.error('Failed to restore site', error instanceof Error ? error : undefined, {
			siteId,
			organizationId: orgId
		});
		throw error;
	}
}
