import { db } from '$lib/server/db';
import { site, organization, apikey, channel } from '$lib/server/db/schema';
import { and, sql } from 'drizzle-orm';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('site-cleanup-job');

/**
 * Cleanup job to permanently delete sites that have been soft-deleted
 * beyond the organization's retention period.
 *
 * This job should be run periodically (e.g., daily) to clean up old archived sites.
 *
 * Retention policies:
 * - basic: 90 days
 * - premium: 365 days
 * - unlimited: never delete (no cleanup)
 */
export async function cleanupDeletedSites(): Promise<{
	sitesDeleted: number;
	channelsDeleted: number;
	apiKeysDeleted: number;
}> {
	const operation = logger.start('Cleanup deleted sites job');

	try {
		// Calculate cutoff dates for each retention tier
		const now = new Date();
		const basicCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
		const premiumCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 365 days

		operation.step('Finding sites eligible for deletion');

		// Find all soft-deleted sites that exceed their org's retention period
		// We need to join with organization to check retention_tier
		const eligibleSites = await db
			.select({
				siteId: site.id,
				siteName: site.name,
				organizationId: site.organizationId,
				deletedAt: site.deletedAt,
				retentionTier: organization.retentionTier
			})
			.from(site)
			.innerJoin(organization, sql`${site.organizationId} = ${organization.id}`)
			.where(
				and(
					sql`${site.deletedAt} IS NOT NULL`,
					sql`(
						(${organization.retentionTier} = 'basic' AND ${site.deletedAt} < ${basicCutoff})
						OR
						(${organization.retentionTier} = 'premium' AND ${site.deletedAt} < ${premiumCutoff})
					)`
				)
			);

		if (eligibleSites.length === 0) {
			operation.end({ sitesDeleted: 0, channelsDeleted: 0, apiKeysDeleted: 0 });
			logger.info('No sites eligible for cleanup');
			return { sitesDeleted: 0, channelsDeleted: 0, apiKeysDeleted: 0 };
		}

		operation.step('Deleting associated data', {
			eligibleSitesCount: eligibleSites.length
		});

		let totalChannelsDeleted = 0;
		let totalApiKeysDeleted = 0;

		// Process each site
		for (const siteRecord of eligibleSites) {
			const siteOperation = logger.start('Delete site permanently', {
				siteId: siteRecord.siteId,
				siteName: siteRecord.siteName,
				organizationId: siteRecord.organizationId,
				retentionTier: siteRecord.retentionTier
			});

			try {
				// Delete associated channels (cascade will handle webhooks)
				const deletedChannels = await db
					.delete(channel)
					.where(sql`${channel.siteId} = ${siteRecord.siteId}`)
					.returning();
				totalChannelsDeleted += deletedChannels.length;

				// Delete associated API keys
				const deletedApiKeys = await db
					.delete(apikey)
					.where(sql`${apikey.metadata}->>'siteId' = ${siteRecord.siteId}`)
					.returning();
				totalApiKeysDeleted += deletedApiKeys.length;

				// Finally, delete the site itself
				await db.delete(site).where(sql`${site.id} = ${siteRecord.siteId}`);

				siteOperation.end({
					channelsDeleted: deletedChannels.length,
					apiKeysDeleted: deletedApiKeys.length
				});
			} catch (error) {
				siteOperation.error('Failed to delete site', error instanceof Error ? error : undefined, {
					siteId: siteRecord.siteId
				});
				// Continue with next site even if one fails
			}
		}

		operation.end({
			sitesDeleted: eligibleSites.length,
			channelsDeleted: totalChannelsDeleted,
			apiKeysDeleted: totalApiKeysDeleted
		});

		logger.success('Cleanup job completed', {
			sitesDeleted: eligibleSites.length,
			channelsDeleted: totalChannelsDeleted,
			apiKeysDeleted: totalApiKeysDeleted
		});

		return {
			sitesDeleted: eligibleSites.length,
			channelsDeleted: totalChannelsDeleted,
			apiKeysDeleted: totalApiKeysDeleted
		};
	} catch (error) {
		operation.error('Cleanup job failed', error instanceof Error ? error : undefined);
		throw error;
	}
}
