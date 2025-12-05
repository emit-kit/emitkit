import type { Component } from 'svelte';
import SlackIcon from '@lucide/svelte/icons/slack';
import MessageSquareIcon from '@lucide/svelte/icons/message-square';
import MailIcon from '@lucide/svelte/icons/mail';
import WebhookIcon from '@lucide/svelte/icons/webhook';

export type IntegrationDefinition = {
	id: string;
	name: string;
	description: string;
	icon: Component;
	status: 'available' | 'coming_soon';
	category: 'notification' | 'messaging' | 'email';
	requiresOAuth: boolean;
	configFields: {
		webhookUrl?: boolean;
		apiKey?: boolean;
		channelId?: boolean;
		email?: boolean;
	};
};

export const AVAILABLE_INTEGRATIONS: IntegrationDefinition[] = [
	{
		id: 'slack',
		name: 'Slack',
		description: 'Send event notifications to Slack channels via webhooks',
		icon: SlackIcon,
		status: 'available',
		category: 'messaging',
		requiresOAuth: false,
		configFields: { webhookUrl: true }
	},
	{
		id: 'discord',
		name: 'Discord',
		description: 'Send event notifications to Discord channels via webhooks',
		icon: MessageSquareIcon,
		status: 'available',
		category: 'messaging',
		requiresOAuth: false,
		configFields: { webhookUrl: true }
	},
	{
		id: 'email',
		name: 'Email',
		description: 'Send event notifications via email',
		icon: MailIcon,
		status: 'coming_soon',
		category: 'email',
		requiresOAuth: false,
		configFields: { email: true }
	},
	{
		id: 'webhook',
		name: 'Custom Webhook',
		description: 'Send events to custom HTTP endpoints',
		icon: WebhookIcon,
		status: 'coming_soon',
		category: 'notification',
		requiresOAuth: false,
		configFields: { webhookUrl: true }
	}
];

export function getIntegrationDefinition(type: string): IntegrationDefinition | undefined {
	return AVAILABLE_INTEGRATIONS.find((i) => i.id === type);
}
