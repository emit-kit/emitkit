import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createBetterAuthId } from '$lib/server/db/schema/utils';
import type { Site, SiteInsert, SiteUpdate } from '$lib/server/db/schema';
import type { PaginationParams, PaginatedQueryResult } from '$lib/server/db/utils';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('sites');

export async function createSite(data: Omit<SiteInsert, 'id'>): Promise<Site> {
	const [newSite] = await db
		.insert(site)
		.values({
			id: createBetterAuthId('site'),
			...data,
			createdAt: new Date(),
			updatedAt: new Date()
		})
		.returning();

	if (!newSite) {
		const error = new Error('Failed to create site');
		logger.error('Site creation failed', error, {
			organizationId: data.organizationId,
			name: data.name,
			slug: data.slug
		});
		throw error;
	}

	logger.info('Site created', {
		id: newSite.id,
		organizationId: newSite.organizationId,
		name: newSite.name,
		slug: newSite.slug
	});

	return newSite;
}

export async function getSiteById(siteId: string, includeDeleted = false): Promise<Site | null> {
	const conditions = [eq(site.id, siteId)];
	if (!includeDeleted) {
		conditions.push(isNull(site.deletedAt));
	}

	const [result] = await db.select().from(site).where(and(...conditions)).limit(1);

	return result ?? null;
}

export async function getSiteByIdAndOrg(
	siteId: string,
	orgId: string,
	includeDeleted = false
): Promise<Site | null> {
	const conditions = [eq(site.id, siteId), eq(site.organizationId, orgId)];
	if (!includeDeleted) {
		conditions.push(isNull(site.deletedAt));
	}

	const [result] = await db.select().from(site).where(and(...conditions)).limit(1);

	return result ?? null;
}

export async function getSiteByOrgAndSlug(
	orgId: string,
	slug: string,
	includeDeleted = false
): Promise<Site | null> {
	const conditions = [eq(site.organizationId, orgId), eq(site.slug, slug)];
	if (!includeDeleted) {
		conditions.push(isNull(site.deletedAt));
	}

	const [result] = await db.select().from(site).where(and(...conditions)).limit(1);

	return result ?? null;
}

export async function listSitesByOrg(
	orgId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Site>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	// Get sites (API keys are managed separately) - exclude soft-deleted
	const sites = await db
		.select()
		.from(site)
		.where(and(eq(site.organizationId, orgId), isNull(site.deletedAt)))
		.orderBy(site.createdAt)
		.limit(limit)
		.offset(offset);

	// Get total count - exclude soft-deleted
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(site)
		.where(and(eq(site.organizationId, orgId), isNull(site.deletedAt)));

	// Build pagination metadata
	const total = Number(count);
	const totalPages = Math.ceil(total / limit);

	return {
		items: sites,
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

export async function updateSite(siteId: string, data: SiteUpdate): Promise<Site> {
	const [updated] = await db
		.update(site)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(site.id, siteId))
		.returning();

	if (!updated) {
		const error = new Error('Failed to update site or site not found');
		logger.error('Site update failed', error, { siteId, updatedFields: Object.keys(data) });
		throw error;
	}

	logger.info('Site updated', {
		id: updated.id,
		updatedFields: Object.keys(data),
		organizationId: updated.organizationId
	});

	return updated;
}

export async function softDeleteSite(siteId: string): Promise<Site> {
	const [deleted] = await db
		.update(site)
		.set({
			deletedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(site.id, siteId))
		.returning();

	if (!deleted) {
		const error = new Error('Failed to soft delete site or site not found');
		logger.error('Site soft delete failed', error, { siteId });
		throw error;
	}

	logger.info('Site soft deleted', { siteId, deletedAt: deleted.deletedAt });

	return deleted;
}

export async function restoreSite(siteId: string): Promise<Site> {
	const [restored] = await db
		.update(site)
		.set({
			deletedAt: null,
			updatedAt: new Date()
		})
		.where(eq(site.id, siteId))
		.returning();

	if (!restored) {
		const error = new Error('Failed to restore site or site not found');
		logger.error('Site restore failed', error, { siteId });
		throw error;
	}

	logger.info('Site restored', { siteId });

	return restored;
}

export async function hardDeleteSite(siteId: string, orgId: string): Promise<void> {
	const result = await db
		.delete(site)
		.where(and(eq(site.id, siteId), eq(site.organizationId, orgId)))
		.returning();

	if (result.length === 0) {
		const error = new Error('Site not found or access denied');
		logger.error('Hard delete failed: site not found or access denied', error, { siteId, orgId });
		throw error;
	}

	logger.warn('Site hard deleted (permanent)', { siteId, organizationId: orgId });
}

export async function listDeletedSitesByOrg(
	orgId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Site>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	// Get only soft-deleted sites
	const sites = await db
		.select()
		.from(site)
		.where(and(eq(site.organizationId, orgId), sql`${site.deletedAt} IS NOT NULL`))
		.orderBy(site.deletedAt)
		.limit(limit)
		.offset(offset);

	// Get total count of soft-deleted sites
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(site)
		.where(and(eq(site.organizationId, orgId), sql`${site.deletedAt} IS NOT NULL`));

	// Build pagination metadata
	const total = Number(count);
	const totalPages = Math.ceil(total / limit);

	return {
		items: sites,
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
	// Check if slug is available (excluding soft-deleted sites)
	const existing = await getSiteByOrgAndSlug(orgId, slug, false);
	const available = !existing;

	return available;
}
