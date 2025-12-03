export type Event = {
	id: string;
	channelId: string;
	siteId: string;
	organizationId: string;
	title: string;
	description: string | null;
	icon: string | null;
	tags: string[];
	metadata: Record<string, unknown>;
	userId: string | null;
	notify: boolean;
	displayAs: string;
	source: string;
	createdAt: Date;
};

export type EventInsert = {
	id?: string;
	channelId: string;
	siteId: string;
	organizationId: string;
	title: string;
	description?: string | null;
	icon?: string | null;
	tags?: string[];
	metadata?: Record<string, unknown>;
	userId?: string | null;
	notify?: boolean;
	displayAs?: string;
	source?: string;
	createdAt?: Date;
};
