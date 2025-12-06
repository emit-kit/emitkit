import { serve } from '@upstash/workflow/svelte';
import { env } from '$env/dynamic/private';
import { createContextLogger } from '$lib/server/logger';
import {
	fetchEventDetails,
	processNotifications,
	processWebhooks,
	processIntegrations,
	processVisualWorkflows
} from '$lib/features/workflows/server/event-workflow-helpers';

const logger = createContextLogger('workflow-events');

type EventWorkflowPayload = {
	eventId: string;
	channelId: string;
	organizationId: string;
	folderId: string | null;
	notify: boolean;
	eventType: string;
	tags: string[];
};

/**
 * Upstash Workflow endpoint for processing event-triggered side effects
 *
 * This endpoint processes events durably with automatic retries:
 * 1. Fetch event details from Tinybird
 * 2. Send push notifications (if enabled)
 * 3. Dispatch webhooks
 * 4. Execute integrations (Slack, Discord, Email)
 * 5. Execute user-configured visual workflows
 *
 * Each step is durable - if the function crashes, it resumes from the last completed step.
 * QStash handles retries with exponential backoff for failed steps.
 */
export const { POST } = serve<EventWorkflowPayload>(
	async (context) => {
		const payload = context.requestPayload;

		logger.info('Starting event workflow', {
			eventId: payload.eventId,
			channelId: payload.channelId,
			organizationId: payload.organizationId
		});

		// Step 1: Fetch full event details from Tinybird
		// This step is durable - if it fails, QStash will retry
		const event = await context.run('fetch-event', async () => {
			return await fetchEventDetails(payload.eventId);
		});

		logger.info('Event fetched', {
			eventId: event.id,
			title: event.title
		});

		// Step 2: Send push notifications (if enabled)
		// Once step 1 completes, it never re-executes even if this step fails
		if (payload.notify) {
			const notificationResult = await context.run('push-notifications', async () => {
				return await processNotifications(event, payload.channelId);
			});

			logger.info('Notifications processed', {
				eventId: event.id,
				sent: notificationResult.sent,
				failed: notificationResult.failed
			});
		} else {
			logger.info('Notifications skipped (notify=false)', {
				eventId: event.id
			});
		}

		// Step 3: Dispatch webhooks to configured endpoints
		const webhookResult = await context.run('dispatch-webhooks', async () => {
			return await processWebhooks(event, payload.channelId, payload.organizationId);
		});

		logger.info('Webhooks dispatched', {
			eventId: event.id,
			dispatched: webhookResult.dispatched
		});

		// Step 4: Execute integrations (Slack, Discord, Email)
		const integrationResult = await context.run('execute-integrations', async () => {
			return await processIntegrations(
				event,
				payload.organizationId,
				payload.folderId,
				payload.channelId
			);
		});

		logger.info('Integrations executed', {
			eventId: event.id,
			executed: integrationResult.executed,
			succeeded: integrationResult.succeeded,
			failed: integrationResult.failed
		});

		// Step 5: Execute user-configured visual workflows
		if (payload.folderId) {
			const workflowResult = await context.run('visual-workflows', async () => {
				return await processVisualWorkflows(event);
			});

			logger.info('Visual workflows processed', {
				eventId: event.id,
				matched: workflowResult.matched,
				executed: workflowResult.executed
			});
		} else {
			logger.info('Visual workflows skipped (no folderId)', {
				eventId: event.id
			});
		}

		logger.info('Event workflow completed successfully', {
			eventId: payload.eventId,
			channelId: payload.channelId
		});

		return {
			success: true,
			eventId: payload.eventId,
			results: {
				notifications: payload.notify,
				webhooks: webhookResult.dispatched,
				integrations: integrationResult.executed,
				visualWorkflows: payload.folderId ? true : false
			}
		};
	},
	{ env }
);
