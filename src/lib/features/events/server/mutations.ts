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
import { waitUntil } from '$lib/server/wait-until';

const logger = createLogger('events');

export async function createAndBroadcastEvent(event: EventInsert): Promise<Event> {
	// Fetch channel with folder information (needed for Tinybird and notifications)
	const channel = await db.query.channel.findFirst({
		where: eq(schema.channel.id, event.channelId),
		columns: { folderId: true },
		with: {
			folder: {
				columns: { name: true }
			}
		}
	});

	if (!channel) {
		throw new Error(`Channel ${event.channelId} not found`);
	}

	// 1. Create the event in Tinybird
	const createdEvent = await createEvent(event, channel.folderId, false);

	// 2. Invalidate caches (non-blocking with waitUntil)
	waitUntil(
		Promise.all([
			invalidateChannelCache(event.channelId),
			invalidateOrganizationCache(event.organizationId)
		]).catch((error) => {
			logger.error('Failed to invalidate cache', error instanceof Error ? error : undefined, {
				eventId: createdEvent.id,
				channelId: event.channelId,
				organizationId: event.organizationId
			});
		})
	);

	// 3. Publish to Redis pub/sub for SSE clients (non-blocking with waitUntil)
	waitUntil(
		publishToChannel(`events:channel:${event.channelId}`, {
			type: 'event',
			data: createdEvent
		}).catch((error) => {
			logger.error('Failed to publish to Redis', error instanceof Error ? error : undefined, {
				eventId: createdEvent.id,
				channelId: event.channelId
			});
		})
	);

	// 4. Send push notifications if notify = true (non-blocking with waitUntil)
	if (event.notify) {
		// Build notification body with folder context
		const folderName = channel.folder?.name || 'Unknown Folder';
		const notificationBody = event.description
			? `${folderName} • ${event.description}`
			: folderName;

		waitUntil(
			sendPushNotificationToChannels([event.channelId], {
				title: event.title,
				body: notificationBody,
				icon: event.icon || undefined,
				tag: createdEvent.id,
				data: {
					eventId: createdEvent.id,
					channelId: event.channelId,
					folderId: channel.folderId,
					url: `/events/${channel.folderId}/${event.channelId}`
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
			})
		);
	}

	return createdEvent;
}
