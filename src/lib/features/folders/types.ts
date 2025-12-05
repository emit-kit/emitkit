import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { folder, type Folder } from '$lib/server/db/schema';

export type { Folder, FolderInsert, FolderUpdate } from '$lib/server/db/schema';

export const selectFolderSchema = createSelectSchema(folder);
export const insertFolderSchema = createInsertSchema(folder);

export type { FolderCreateInput, FolderUpdateInput, FolderListParams } from './validators';

export type FolderListResponse = {
	items: Folder[];
	total: number;
};

export type FolderCreateResponse = {
	folder: Folder;
	apiKey: {
		id: string;
		key: string; // Full API key (only returned on creation!)
		start: string | null;
		name: string | null;
	};
};
