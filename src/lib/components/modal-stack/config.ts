import { stack } from '@svelte-put/async-stack';
import { ChannelModal } from '$lib/features/channels/components/channel-modal';
import { NotificationPromptModal } from '$lib/features/notifications/components';
import { RenameSiteModal } from '$lib/features/sites/components/rename-site-modal';
import { DeleteSiteModal } from '$lib/features/sites/components/delete-site-modal';
import { RestoreSiteModal } from '$lib/features/sites/components/restore-site-modal';

export const modalStack = stack()
	.addVariant('channel', ChannelModal)
	.addVariant('notificationPrompt', NotificationPromptModal)
	.addVariant('renameSite', RenameSiteModal)
	.addVariant('deleteSite', DeleteSiteModal)
	.addVariant('restoreSite', RestoreSiteModal)
	.build();

export type ModalStack = typeof modalStack;
