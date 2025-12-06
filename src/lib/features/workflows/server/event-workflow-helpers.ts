import type { Event } from '$lib/server/db/schema';
import { getEventById } from '$lib/features/events/server/tinybird.service';
import { sendPushNotificationToChannels } from '$lib/features/notifications/server/push.service';
import { listWebhooks } from '$lib/features/webhooks/server/repository';
import { dispatchWebhooks } from '$lib/features/webhooks/server/dispatch';
import { getIntegrationsForEvent } from '$lib/features/integrations/server/repository';
import { matchAndExecuteWorkflows } from './trigger-matcher';
import { createContextLogger } from '$lib/server/logger';

const logger = createContextLogger('event-workflow-helpers');

/**
 * Step 1: Fetch event details from Tinybird
 */
export async function fetchEventDetails(eventId: string): Promise<Event> {
	logger.info('Fetching event details', { eventId });

	const event = await getEventById(eventId);
	if (!event) {
		throw new Error(`Event ${eventId} not found`);
	}

	return event;
}

/**
 * Step 2: Send push notifications to channel subscribers
 */
export async function processNotifications(
	event: Event,
	channelId: string
): Promise<{ sent: number; failed: number }> {
	logger.info('Processing push notifications', {
		eventId: event.id,
		channelId
	});

	const result = await sendPushNotificationToChannels([channelId], {
		title: event.title,
		body: event.description || undefined,
		icon: event.icon || undefined,
		tag: `event-${event.id}`,
		data: {
			eventId: event.id,
			channelId: event.channelId
		},
		url: `/channels/${channelId}/events/${event.id}`
	});

	logger.info('Push notifications sent', {
		eventId: event.id,
		totalSuccess: result.totalSuccess,
		totalFailed: result.totalFailed
	});

	return {
		sent: result.totalSuccess,
		failed: result.totalFailed
	};
}

/**
 * Step 3: Dispatch webhooks to configured endpoints
 */
export async function processWebhooks(
	event: Event,
	channelId: string,
	orgId: string
): Promise<{ dispatched: number }> {
	logger.info('Processing webhooks', {
		eventId: event.id,
		channelId
	});

	const webhooks = await listWebhooks(channelId, orgId);

	if (webhooks.length === 0) {
		logger.info('No webhooks configured', { channelId });
		return { dispatched: 0 };
	}

	await dispatchWebhooks(webhooks, event);

	logger.info('Webhooks dispatched', {
		eventId: event.id,
		count: webhooks.length
	});

	return { dispatched: webhooks.length };
}

/**
 * Step 4: Execute integrations (Slack, Discord, Email)
 */
export async function processIntegrations(
	event: Event,
	orgId: string,
	folderId: string | null,
	channelId: string
): Promise<{ executed: number; succeeded: number; failed: number }> {
	logger.info('Processing integrations', {
		eventId: event.id,
		orgId
	});

	const integrations = await getIntegrationsForEvent(orgId, folderId, channelId, {
		type: event.title,
		tags: event.tags || []
	});

	if (integrations.length === 0) {
		logger.info('No matching integrations', { eventId: event.id });
		return { executed: 0, succeeded: 0, failed: 0 };
	}

	// Execute all integrations in parallel
	const results = await Promise.allSettled(
		integrations.map(async (integration) => {
			// Execute integration handler based on type
			// TODO: Implement integration execution logic
			logger.info('Executing integration', {
				integrationId: integration.id,
				type: integration.type
			});
		})
	);

	const succeeded = results.filter((r) => r.status === 'fulfilled').length;
	const failed = results.filter((r) => r.status === 'rejected').length;

	logger.info('Integrations executed', {
		eventId: event.id,
		total: integrations.length,
		succeeded,
		failed
	});

	return {
		executed: integrations.length,
		succeeded,
		failed
	};
}

/**
 * Step 5: Execute user-configured visual workflows
 */
export async function processVisualWorkflows(
	event: Event
): Promise<{ matched: number; executed: number }> {
	logger.info('Processing visual workflows', {
		eventId: event.id,
		folderId: event.folderId
	});

	// This calls the existing workflow matching/execution logic
	await matchAndExecuteWorkflows({
		eventId: event.id,
		channelId: event.channelId,
		folderId: event.folderId || '',
		organizationId: event.organizationId,
		title: event.title,
		description: event.description || undefined,
		tags: event.tags || undefined,
		metadata: event.metadata as Record<string, unknown> | undefined
	});

	logger.info('Visual workflows processed', { eventId: event.id });

	return { matched: 0, executed: 0 }; // TODO: Return actual counts from matchAndExecuteWorkflows
}
