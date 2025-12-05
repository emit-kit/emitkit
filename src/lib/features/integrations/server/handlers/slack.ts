import type { Event } from '$lib/server/db/schema';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('slack-integration');

export async function sendSlackNotification(
	config: Record<string, unknown>,
	event: Event
): Promise<void> {
	const webhookUrl = config.webhookUrl as string;

	if (!webhookUrl) {
		throw new Error('Slack webhook URL not configured');
	}

	const slackPayload = {
		text: event.title,
		blocks: [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*${event.title}*${event.description ? `\n${event.description}` : ''}`
				}
			},
			{
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: `Channel: ${event.channelId} • ${new Date(event.createdAt).toLocaleString()}`
					}
				]
			}
		]
	};

	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(slackPayload),
		signal: AbortSignal.timeout(10000) // 10s timeout
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Slack API error: ${response.status} ${errorText}`);
	}

	logger.success('Slack notification sent', {
		eventId: event.id,
		channelId: event.channelId
	});
}
