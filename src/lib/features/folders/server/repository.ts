import { db } from '$lib/server/db';
import { folder } from '$lib/server/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createBetterAuthId } from '$lib/server/db/schema/utils';
import type { Folder, FolderInsert, FolderUpdate } from '$lib/server/db/schema';
import type { PaginationParams, PaginatedQueryResult } from '$lib/server/db/utils';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('folders');

export async function createFolder(data: Omit<FolderInsert, 'id'>): Promise<Folder> {
	const [newFolder] = await db
		.insert(folder)
		.values({
			id: createBetterAuthId('folder'),
			...data,
			createdAt: new Date(),
			updatedAt: new Date()
		})
		.returning();

	if (!newFolder) {
		const error = new Error('Failed to create folder');
		logger.error('Folder creation failed', error, {
			organizationId: data.organizationId,
			name: data.name,
			slug: data.slug
		});
		throw error;
	}

	logger.info('Folder created', {
		id: newFolder.id,
		organizationId: newFolder.organizationId,
		name: newFolder.name,
		slug: newFolder.slug
	});

	return newFolder;
}

export async function getFolderById(folderId: string, includeDeleted = false): Promise<Folder | null> {
	const conditions = [eq(folder.id, folderId)];
	if (!includeDeleted) {
		conditions.push(isNull(folder.deletedAt));
	}

	const [result] = await db.select().from(folder).where(and(...conditions)).limit(1);

	return result ?? null;
}

export async function getFolderByIdAndOrg(
	folderId: string,
	orgId: string,
	includeDeleted = false
): Promise<Folder | null> {
	const conditions = [eq(folder.id, folderId), eq(folder.organizationId, orgId)];
	if (!includeDeleted) {
		conditions.push(isNull(folder.deletedAt));
	}

	const [result] = await db.select().from(folder).where(and(...conditions)).limit(1);

	return result ?? null;
}

export async function getFolderByOrgAndSlug(
	orgId: string,
	slug: string,
	includeDeleted = false
): Promise<Folder | null> {
	const conditions = [eq(folder.organizationId, orgId), eq(folder.slug, slug)];
	if (!includeDeleted) {
		conditions.push(isNull(folder.deletedAt));
	}

	const [result] = await db.select().from(folder).where(and(...conditions)).limit(1);

	return result ?? null;
}

export async function listFoldersByOrg(
	orgId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Folder>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	// Get folders (API keys are managed separately) - exclude soft-deleted
	const folders = await db
		.select()
		.from(folder)
		.where(and(eq(folder.organizationId, orgId), isNull(folder.deletedAt)))
		.orderBy(folder.createdAt)
		.limit(limit)
		.offset(offset);

	// Get total count - exclude soft-deleted
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(folder)
		.where(and(eq(folder.organizationId, orgId), isNull(folder.deletedAt)));

	// Build pagination metadata
	const total = Number(count);
	const totalPages = Math.ceil(total / limit);

	return {
		items: folders,
		metadata: {
			total,
			page,
			limit,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1
		}
	};
}

export async function updateFolder(folderId: string, data: FolderUpdate): Promise<Folder> {
	const [updated] = await db
		.update(folder)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(folder.id, folderId))
		.returning();

	if (!updated) {
		const error = new Error('Failed to update folder or folder not found');
		logger.error('Folder update failed', error, { folderId, updatedFields: Object.keys(data) });
		throw error;
	}

	logger.info('Folder updated', {
		id: updated.id,
		updatedFields: Object.keys(data),
		organizationId: updated.organizationId
	});

	return updated;
}

export async function softDeleteFolder(folderId: string): Promise<Folder> {
	const [deleted] = await db
		.update(folder)
		.set({
			deletedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(folder.id, folderId))
		.returning();

	if (!deleted) {
		const error = new Error('Failed to soft delete folder or folder not found');
		logger.error('Folder soft delete failed', error, { folderId });
		throw error;
	}

	logger.info('Folder soft deleted', { folderId, deletedAt: deleted.deletedAt });

	return deleted;
}

export async function restoreFolder(folderId: string): Promise<Folder> {
	const [restored] = await db
		.update(folder)
		.set({
			deletedAt: null,
			updatedAt: new Date()
		})
		.where(eq(folder.id, folderId))
		.returning();

	if (!restored) {
		const error = new Error('Failed to restore folder or folder not found');
		logger.error('Folder restore failed', error, { folderId });
		throw error;
	}

	logger.info('Folder restored', { folderId });

	return restored;
}

export async function hardDeleteFolder(folderId: string, orgId: string): Promise<void> {
	const result = await db
		.delete(folder)
		.where(and(eq(folder.id, folderId), eq(folder.organizationId, orgId)))
		.returning();

	if (result.length === 0) {
		const error = new Error('Folder not found or access denied');
		logger.error('Hard delete failed: folder not found or access denied', error, { folderId, orgId });
		throw error;
	}

	logger.warn('Folder hard deleted (permanent)', { folderId, organizationId: orgId });
}

export async function listDeletedFoldersByOrg(
	orgId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Folder>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	// Get only soft-deleted folders
	const folders = await db
		.select()
		.from(folder)
		.where(and(eq(folder.organizationId, orgId), sql`${folder.deletedAt} IS NOT NULL`))
		.orderBy(folder.deletedAt)
		.limit(limit)
		.offset(offset);

	// Get total count of soft-deleted folders
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(folder)
		.where(and(eq(folder.organizationId, orgId), sql`${folder.deletedAt} IS NOT NULL`));

	// Build pagination metadata
	const total = Number(count);
	const totalPages = Math.ceil(total / limit);

	return {
		items: folders,
		metadata: {
			total,
			page,
			limit,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1
		}
	};
}

export async function isSlugAvailable(orgId: string, slug: string): Promise<boolean> {
	// Check if slug is available (excluding soft-deleted folders)
	const existing = await getFolderByOrgAndSlug(orgId, slug, false);
	const available = !existing;

	return available;
}
