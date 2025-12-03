import type { PushSubscription } from '$lib/server/db/schema';
import type { Site } from '$lib/features/sites/types';
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

export type SiteWithChannels = Site & {
	channels: Channel[];
};

export type NotificationSettings = {
	enabledSites: Set<string>;
	enabledChannels: Set<string>;
	subscribeToAll: boolean;
};
