import { json, type RequestHandler } from '@sveltejs/kit';
import { cleanupDeletedFolders } from '$lib/features/folders/server/jobs/cleanup-deleted-folders';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('cron-cleanup-folders');

/**
 * Cron endpoint to cleanup soft-deleted folders
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions)
 * to periodically clean up folders that have been soft-deleted beyond the retention period.
 *
 * Security:
 * - In production, this endpoint should be protected by a cron secret or API key
 * - Vercel Cron: Add CRON_SECRET to environment variables
 * - Check the Authorization header or a custom header
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-folders",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export const GET: RequestHandler = async ({ request }) => {
	const operation = logger.start('Cron job: cleanup folders');

	try {
		// Security check: Verify cron secret in production
		const authHeader = request.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		// In production, enforce cron secret
		if (process.env.NODE_ENV === 'production' && cronSecret) {
			if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
				logger.error('Unauthorized cron access attempt', undefined, {
					hasAuthHeader: !!authHeader,
					ip: request.headers.get('x-forwarded-for')
				});
				return json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		operation.step('Running cleanup job');
		const result = await cleanupDeletedFolders();

		operation.end(result);

		return json({
			success: true,
			...result,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		operation.error('Cron job failed', error instanceof Error ? error : undefined);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};
