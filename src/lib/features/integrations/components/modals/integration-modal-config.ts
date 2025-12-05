import { stack } from '@svelte-put/async-stack';
import SlackConnectModal from './slack-connect-modal/slack-connect-modal.svelte';
import DiscordConnectModal from './discord-connect-modal/discord-connect-modal.svelte';
import IntegrationDetailsModal from './integration-details-modal/integration-details-modal.svelte';
import IntegrationDeleteModal from './integration-delete-modal/integration-delete-modal.svelte';

export const integrationModalStack = stack()
	.addVariant('slack-connect', SlackConnectModal)
	.addVariant('discord-connect', DiscordConnectModal)
	.addVariant('details', IntegrationDetailsModal)
	.addVariant('delete', IntegrationDeleteModal)
	.build();

export type IntegrationModalStack = typeof integrationModalStack;
