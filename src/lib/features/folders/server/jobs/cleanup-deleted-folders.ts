import { db } from '$lib/server/db';
import { folder, organization, apikey, channel } from '$lib/server/db/schema';
import { and, sql } from 'drizzle-orm';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('folder-cleanup-job');

/**
 * Cleanup job to permanently delete folders that have been soft-deleted
 * beyond the organization's retention period.
 *
 * This job should be run periodically (e.g., daily) to clean up old archived folders.
 *
 * Retention policies:
 * - basic: 90 days
 * - premium: 365 days
 * - unlimited: never delete (no cleanup)
 */
export async function cleanupDeletedFolders(): Promise<{
	foldersDeleted: number;
	channelsDeleted: number;
	apiKeysDeleted: number;
}> {
	const operation = logger.start('Cleanup deleted folders job');

	try {
		// Calculate cutoff dates for each retention tier
		const now = new Date();
		const basicCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
		const premiumCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 365 days

		operation.step('Finding folders eligible for deletion');

		// Find all soft-deleted folders that exceed their org's retention period
		// We need to join with organization to check retention_tier
		const eligibleFolders = await db
			.select({
				folderId: folder.id,
				folderName: folder.name,
				organizationId: folder.organizationId,
				deletedAt: folder.deletedAt,
				retentionTier: organization.retentionTier
			})
			.from(folder)
			.innerJoin(organization, sql`${folder.organizationId} = ${organization.id}`)
			.where(
				and(
					sql`${folder.deletedAt} IS NOT NULL`,
					sql`(
						(${organization.retentionTier} = 'basic' AND ${folder.deletedAt} < ${basicCutoff})
						OR
						(${organization.retentionTier} = 'premium' AND ${folder.deletedAt} < ${premiumCutoff})
					)`
				)
			);

		if (eligibleFolders.length === 0) {
			operation.end({ foldersDeleted: 0, channelsDeleted: 0, apiKeysDeleted: 0 });
			logger.info('No folders eligible for cleanup');
			return { foldersDeleted: 0, channelsDeleted: 0, apiKeysDeleted: 0 };
		}

		operation.step('Deleting associated data', {
			eligibleFoldersCount: eligibleFolders.length
		});

		let totalChannelsDeleted = 0;
		let totalApiKeysDeleted = 0;

		// Process each folder
		for (const folderRecord of eligibleFolders) {
			const folderOperation = logger.start('Delete folder permanently', {
				folderId: folderRecord.folderId,
				folderName: folderRecord.folderName,
				organizationId: folderRecord.organizationId,
				retentionTier: folderRecord.retentionTier
			});

			try {
				// Delete associated channels (cascade will handle webhooks)
				const deletedChannels = await db
					.delete(channel)
					.where(sql`${channel.folderId} = ${folderRecord.folderId}`)
					.returning();
				totalChannelsDeleted += deletedChannels.length;

				// Delete associated API keys
				const deletedApiKeys = await db
					.delete(apikey)
					.where(sql`${apikey.metadata}->>'folderId' = ${folderRecord.folderId}`)
					.returning();
				totalApiKeysDeleted += deletedApiKeys.length;

				// Finally, delete the folder itself
				await db.delete(folder).where(sql`${folder.id} = ${folderRecord.folderId}`);

				folderOperation.end({
					channelsDeleted: deletedChannels.length,
					apiKeysDeleted: deletedApiKeys.length
				});
			} catch (error) {
				folderOperation.error('Failed to delete folder', error instanceof Error ? error : undefined, {
					folderId: folderRecord.folderId
				});
				// Continue with next folder even if one fails
			}
		}

		operation.end({
			foldersDeleted: eligibleFolders.length,
			channelsDeleted: totalChannelsDeleted,
			apiKeysDeleted: totalApiKeysDeleted
		});

		logger.success('Cleanup job completed', {
			foldersDeleted: eligibleFolders.length,
			channelsDeleted: totalChannelsDeleted,
			apiKeysDeleted: totalApiKeysDeleted
		});

		return {
			foldersDeleted: eligibleFolders.length,
			channelsDeleted: totalChannelsDeleted,
			apiKeysDeleted: totalApiKeysDeleted
		};
	} catch (error) {
		operation.error('Cleanup job failed', error instanceof Error ? error : undefined);
		throw error;
	}
}
