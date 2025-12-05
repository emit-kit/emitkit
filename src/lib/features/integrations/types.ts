import type { Integration, IntegrationInsert } from '$lib/server/db/schema';
import type { IntegrationDefinition } from './constants';

export type { Integration, IntegrationInsert };

export type IntegrationType = 'slack' | 'discord' | 'email' | 'teams' | 'custom';

export interface IntegrationConfig {
	webhookUrl?: string;
	apiKey?: string;
	channelId?: string;
	email?: string;
	[key: string]: unknown;
}

export type IntegrationWithMetadata = Integration & {
	definition: IntegrationDefinition;
};
