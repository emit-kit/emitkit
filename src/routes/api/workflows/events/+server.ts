import { serve } from '@upstash/workflow/svelte';
import { env } from '$env/dynamic/private';
import { createLogger } from '$lib/server/logger';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { getIntegrationsForEvent } from '$lib/features/integrations/server/repository';
import { sendSlackNotification } from '$lib/features/integrations/server/handlers/slack';
import { sendDiscordNotification } from '$lib/features/integrations/server/handlers/discord';
import { sendEmailNotification } from '$lib/features/integrations/server/handlers/email';
import { listWebhooks } from '$lib/features/webhooks/server/repository';
import { sendWebhook } from '$lib/features/webhooks/server/dispatch';
import { sendPushNotificationToChannels } from '$lib/features/notifications/server';
import type { Event } from '$lib/server/db/schema';

const logger = createLogger('event-workflow');

type EventWorkflowPayload = {
	eventId: string;
	channelId: string;
	organizationId: string;
	folderId: string | null;
	notify: boolean;
	eventType?: string;
	tags?: string[];
};

export const { POST } = serve<EventWorkflowPayload>(
	async (context) => {
		const { eventId, channelId, organizationId, folderId, notify, eventType, tags } =
			context.requestPayload;

		logger.info('Event workflow started', {
			eventId,
			channelId,
			organizationId,
			folderId,
			eventType,
			workflowRunId: context.workflowRunId
		});

		// Step 1: Fetch all relevant integrations (org, folder, channel level) and webhooks
		const { integrations, webhooks, channel } = await context.run('fetch-data', async () => {
			const [integrationsData, webhooksData, channelData] = await Promise.all([
				getIntegrationsForEvent(organizationId, folderId, channelId, {
					type: eventType,
					tags
				}),
				listWebhooks(channelId, organizationId),
				db.query.channel.findFirst({
					where: eq(schema.channel.id, channelId)
				})
			]);

			logger.info('Fetched data for workflow', {
				integrationsCount: integrationsData.length,
				webhooksCount: webhooksData.length,
				eventId
			});

			return {
				integrations: integrationsData,
				webhooks: webhooksData,
				channel: channelData
			};
		});

		// Step 2: Send push notifications (if enabled)
		if (notify && channel) {
			await context.run('push-notifications', async () => {
				await sendPushNotificationToChannels([channelId], {
					title: 'New Event',
					body: `Event ${eventId}`,
					tag: eventId,
					data: {
						eventId,
						channelId,
						url: `/channels/${channelId}`
					}
				});

				logger.info('Push notifications sent', { eventId, channelId });
			});
		}

		// Step 3: Send webhooks
		if (webhooks.length > 0) {
			await context.run('webhooks', async () => {
				const mockEvent = {
					id: eventId,
					channelId,
					organizationId,
					folderId: folderId,
					title: eventType || 'Event',
					description: null,
					tags: tags || [],
					metadata: {},
					notify: notify,
					icon: null,
					userId: null,
					displayAs: 'feed' as const,
					source: 'api' as const,
					createdAt: new Date(),
					timestamp: new Date()
				} as Event;

				await Promise.allSettled(webhooks.map((webhook) => sendWebhook(webhook, mockEvent)));

				logger.info('Webhooks processed', {
					webhooksCount: webhooks.length,
					eventId
				});
			});
		}

		// Step 4: Send integrations (each as separate step for individual retry)
		for (const integration of integrations) {
			await context.run(`integration-${integration.type}-${integration.id}`, async () => {
				const mockEvent = {
					id: eventId,
					channelId,
					organizationId,
					folderId: folderId,
					title: eventType || 'Event',
					description: null,
					tags: tags || [],
					metadata: {},
					notify: notify,
					icon: null,
					userId: null,
					displayAs: 'feed' as const,
					source: 'api' as const,
					createdAt: new Date(),
					timestamp: new Date()
				} as Event;

				switch (integration.type) {
					case 'slack':
						await sendSlackNotification(integration.config, mockEvent);
						logger.info('Slack notification sent', {
							integrationId: integration.id,
							eventId
						});
						break;
					case 'discord':
						await sendDiscordNotification(integration.config, mockEvent);
						logger.info('Discord notification sent', {
							integrationId: integration.id,
							eventId
						});
						break;
					case 'email':
						await sendEmailNotification(integration.config, mockEvent);
						logger.info('Email notification sent', {
							integrationId: integration.id,
							eventId
						});
						break;
					default:
						logger.warn('Unknown integration type', {
							type: integration.type,
							integrationId: integration.id
						});
				}
			});
		}

		logger.success('Event workflow completed', {
			eventId,
			workflowRunId: context.workflowRunId,
			pushNotifications: notify,
			webhooksCount: webhooks.length,
			integrationsCount: integrations.length
		});
	},
	{
		env,
		retries: 3,
		failureUrl: `${env.VERCEL_URL}/api/workflows/events/failure`
	}
);
