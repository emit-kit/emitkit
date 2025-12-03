import { stack } from '@svelte-put/async-stack';
import { ChannelModal } from '$lib/features/channels/components/channel-modal';
import { NotificationPromptModal } from '$lib/features/notifications/components';

export const modalStack = stack()
	.addVariant('channel', ChannelModal)
	.addVariant('notificationPrompt', NotificationPromptModal)
	.build();

export type ModalStack = typeof modalStack;
