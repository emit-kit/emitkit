import type { EventInsert, Event } from '$lib/server/db/schema';
import { createEvent } from './tinybird.service';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { createContextLogger } from '$lib/server/logger';
import {
	invalidateChannelCache,
	invalidateOrganizationCache,
	publishToChannel
} from '$lib/server/cache';
import { waitUntil } from '$lib/server/wait-until';
import { triggerWorkflow } from '$lib/server/workflow';
import { matchAndExecuteWorkflows } from '$lib/features/workflows/server/trigger-matcher';

const logger = createContextLogger('events');

export async function createAndBroadcastEvent(event: EventInsert): Promise<Event> {
	// Fetch channel with folder information
	const channel = await db.query.channel.findFirst({
		where: eq(schema.channel.id, event.channelId),
		columns: { id: true, folderId: true }
	});

	if (!channel) {
		throw new Error(`Channel ${event.channelId} not found`);
	}

	const folderId = channel.folderId;

	// 1. Create the event in Tinybird
	const createdEvent = await createEvent(event, folderId ?? undefined, false);

	// 2. Fire-and-forget non-critical side effects
	waitUntil(
		Promise.all([
			invalidateChannelCache(event.channelId),
			invalidateOrganizationCache(event.organizationId),
			publishToChannel(`events:channel:${event.channelId}`, {
				type: 'event',
				data: createdEvent
			})
		]).catch((error) => {
			logger.error('Non-critical side effects failed', error instanceof Error ? error : undefined, {
				eventId: createdEvent.id,
				channelId: event.channelId
			});
		})
	);

	// 3. Trigger Upstash Workflow for critical side effects
	// This includes: push notifications, webhooks, integrations
	triggerWorkflow('/api/workflows/events', {
		eventId: createdEvent.id,
		channelId: createdEvent.channelId,
		organizationId: createdEvent.organizationId,
		folderId: folderId ?? null,
		notify: event.notify ?? true,
		eventType: event.title, // Use title as event type for now
		tags: event.tags || []
	}).catch((error) => {
		// Log but don't fail the request - workflow will retry automatically
		logger.error('Failed to trigger event workflow', error instanceof Error ? error : undefined, {
			eventId: createdEvent.id,
			channelId: event.channelId
		});
	});

	// 4. Match and execute visual workflows (fire-and-forget)
	if (folderId) {
		waitUntil(
			matchAndExecuteWorkflows({
				eventId: createdEvent.id,
				channelId: createdEvent.channelId,
				folderId,
				organizationId: createdEvent.organizationId,
				title: createdEvent.title,
				description: createdEvent.description ?? undefined,
				tags: createdEvent.tags,
				metadata: createdEvent.metadata as Record<string, unknown> | undefined
			}).catch((error) => {
				logger.error('Workflow matching failed', error instanceof Error ? error : undefined, {
					eventId: createdEvent.id
				});
			})
		);
	}

	return createdEvent;
}
