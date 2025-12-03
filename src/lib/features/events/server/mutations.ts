import type { EventInsert, Event } from '$lib/server/db/schema';
import { createEvent } from './tinybird.service';
import { sendPushNotificationToChannels } from '$lib/features/notifications/server';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { createLogger } from '$lib/server/logger';
import {
	invalidateChannelCache,
	invalidateOrganizationCache,
	publishToChannel
} from '$lib/server/cache';

const logger = createLogger('events');

export async function createAndBroadcastEvent(event: EventInsert): Promise<Event> {
	// Fetch siteId from channel (needed for Tinybird)
	const channel = await db.query.channel.findFirst({
		where: eq(schema.channel.id, event.channelId),
		columns: { siteId: true }
	});

	if (!channel) {
		throw new Error(`Channel ${event.channelId} not found`);
	}

	// 1. Create the event in Tinybird
	const createdEvent = await createEvent(event, channel.siteId, false);

	// 2. Invalidate caches (non-blocking)
	Promise.all([
		invalidateChannelCache(event.channelId),
		invalidateOrganizationCache(event.organizationId)
	]).catch((error) => {
		logger.error('Failed to invalidate cache', error instanceof Error ? error : undefined, {
			eventId: createdEvent.id,
			channelId: event.channelId,
			organizationId: event.organizationId
		});
	});

	// 3. Publish to Redis pub/sub for SSE clients (non-blocking)
	publishToChannel(`events:channel:${event.channelId}`, {
		type: 'event',
		data: createdEvent
	}).catch((error) => {
		logger.error('Failed to publish to Redis', error instanceof Error ? error : undefined, {
			eventId: createdEvent.id,
			channelId: event.channelId
		});
	});

	// 4. Send push notifications if notify = true (non-blocking)
	if (event.notify) {
		sendPushNotificationToChannels([event.channelId], {
			title: event.title,
			body: event.description || undefined,
			icon: event.icon || undefined,
			tag: createdEvent.id,
			data: {
				eventId: createdEvent.id,
				channelId: event.channelId,
				url: `/channels/${event.channelId}`
			}
		}).catch((error) => {
			// Log but don't fail the request if push notifications fail
			logger.error(
				'Failed to send push notifications',
				error instanceof Error ? error : undefined,
				{
					eventId: createdEvent.id,
					channelId: event.channelId,
					organizationId: event.organizationId
				}
			);
		});
	}

	return createdEvent;
}
