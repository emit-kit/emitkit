import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { site, type Site } from '$lib/server/db/schema';

export type { Site, SiteInsert, SiteUpdate } from '$lib/server/db/schema';

export const selectSiteSchema = createSelectSchema(site);
export const insertSiteSchema = createInsertSchema(site);

export type { SiteCreateInput, SiteUpdateInput, SiteListParams } from './validators';

export type SiteListResponse = {
	items: Site[];
	total: number;
};

export type SiteCreateResponse = {
	site: Site;
	apiKey: {
		id: string;
		key: string; // Full API key (only returned on creation!)
		start: string | null;
		name: string | null;
	};
};
