import type { RequestHandler } from './$types';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('event-workflow-failures');

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	logger.error('Event workflow failed after all retries', undefined, {
		workflowRunId: body.workflowRunId,
		payload: body.payload,
		error: body.error,
		failedStep: body.failedStep
	});

	// TODO: Could:
	// - Send to Sentry
	// - Store in DB for manual retry
	// - Notify admins via email/Slack
	// - Create support ticket

	return new Response('OK', { status: 200 });
};
