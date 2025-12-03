import { db } from '$lib/server/db';
import { site } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
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

export async function getSiteById(siteId: string): Promise<Site | null> {
	const [result] = await db.select().from(site).where(eq(site.id, siteId)).limit(1);

	return result ?? null;
}

export async function getSiteByIdAndOrg(siteId: string, orgId: string): Promise<Site | null> {
	const [result] = await db
		.select()
		.from(site)
		.where(and(eq(site.id, siteId), eq(site.organizationId, orgId)))
		.limit(1);

	return result ?? null;
}

export async function getSiteByOrgAndSlug(orgId: string, slug: string): Promise<Site | null> {
	const [result] = await db
		.select()
		.from(site)
		.where(and(eq(site.organizationId, orgId), eq(site.slug, slug)))
		.limit(1);

	return result ?? null;
}

export async function listSitesByOrg(
	orgId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Site>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	// Get sites (API keys are managed separately)
	const sites = await db
		.select()
		.from(site)
		.where(eq(site.organizationId, orgId))
		.orderBy(site.createdAt)
		.limit(limit)
		.offset(offset);

	// Get total count
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(site)
		.where(eq(site.organizationId, orgId));

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

export async function deleteSite(siteId: string): Promise<void> {
	await db.delete(site).where(eq(site.id, siteId));

	logger.info('Site deleted', { siteId });
}

export async function isSlugAvailable(orgId: string, slug: string): Promise<boolean> {
	const existing = await getSiteByOrgAndSlug(orgId, slug);
	const available = !existing;

	return available;
}
