import { auth } from '$lib/server/auth';
import * as siteRepo from './repository';
import type { Site } from '$lib/server/db/schema';
import type { SiteCreateInput, SiteUpdateInput } from '../validators';
import type { SiteCreateResponse } from '../types';
import { db } from '$lib/server/db';
import { apikey } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
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
		// Rollback: delete the site if API key creation failed
		await siteRepo.deleteSite(site.id);
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
	// Verify ownership
	const existing = await siteRepo.getSiteByIdAndOrg(siteId, orgId);
	if (!existing) {
		const error = new Error('Site not found or access denied');
		logger.error('Site deletion failed: not found or access denied', error, { siteId, orgId });
		throw error;
	}

	// Delete all API keys associated with this site
	await db.delete(apikey).where(sql`${apikey.metadata}->>'siteId' = ${siteId}`);

	// Delete the site (will cascade to channels and events)
	await siteRepo.deleteSite(siteId);

	logger.info('Site deleted with API keys', {
		siteId,
		organizationId: orgId,
		name: existing.name
	});
}
