import { stack } from '@svelte-put/async-stack';
import { ChannelModal } from '$lib/features/channels/components/channel-modal';
import { NotificationPromptModal } from '$lib/features/notifications/components';
import { RenameFolderModal } from '$lib/features/folders/components/rename-folder-modal';
import { DeleteFolderModal } from '$lib/features/folders/components/delete-folder-modal';
import { RestoreFolderModal } from '$lib/features/folders/components/restore-folder-modal';

export const modalStack = stack()
	.addVariant('channel', ChannelModal)
	.addVariant('notificationPrompt', NotificationPromptModal)
	.addVariant('renameFolder', RenameFolderModal)
	.addVariant('deleteFolder', DeleteFolderModal)
	.addVariant('restoreFolder', RestoreFolderModal)
	.build();

export type ModalStack = typeof modalStack;
