import type { Event } from '$lib/server/db/schema';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('discord-integration');

export async function sendDiscordNotification(
	config: Record<string, unknown>,
	event: Event
): Promise<void> {
	const webhookUrl = config.webhookUrl as string;

	if (!webhookUrl) {
		throw new Error('Discord webhook URL not configured');
	}

	const discordPayload = {
		content: event.title,
		embeds: [
			{
				title: event.title,
				description: event.description || '',
				color: 0x5865f2, // Discord blurple
				timestamp: event.createdAt.toISOString(),
				footer: {
					text: `Channel: ${event.channelId}`
				}
			}
		]
	};

	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(discordPayload),
		signal: AbortSignal.timeout(10000)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Discord API error: ${response.status} ${errorText}`);
	}

	logger.success('Discord notification sent', {
		eventId: event.id,
		channelId: event.channelId
	});
}
