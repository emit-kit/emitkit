import type { PushSubscription } from '$lib/server/db/schema';
import type { Folder } from '$lib/features/folders/types';
import type { Channel } from '$lib/features/channels/types';

export type { PushSubscription };

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export type BrowserSupport = {
	notifications: boolean;
	serviceWorker: boolean;
	pushManager: boolean;
};

export type SubscriptionState = {
	isSubscribed: boolean;
	subscription: PushSubscription | null;
	permissionState: NotificationPermissionState;
	browserSupport: BrowserSupport;
};

export type FolderWithChannels = Folder & {
	channels: Channel[];
};

export type NotificationSettings = {
	enabledFolders: Set<string>;
	enabledChannels: Set<string>;
	subscribeToAll: boolean;
};
