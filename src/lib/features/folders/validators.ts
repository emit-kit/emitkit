import { z } from 'zod';

export const folderCreateSchema = z.object({
	organizationId: z.string().min(1, 'Organization ID is required'),
	name: z.string().min(1, 'Folder name is required').max(255, 'Folder name is too long'),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(255, 'Slug is too long')
		.regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
	url: z.string().url('Invalid URL format').max(500, 'URL is too long').optional(),
	icon: z.string().max(50).optional(),
	description: z.string().optional()
});

export const folderUpdateSchema = z.object({
	name: z.string().min(1, 'Folder name is required').max(255, 'Folder name is too long').optional(),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(255, 'Slug is too long')
		.regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
		.optional(),
	url: z.string().url('Invalid URL format').max(500, 'URL is too long').optional(),
	icon: z.string().max(50).optional(),
	description: z.string().optional()
});

export const folderListParamsSchema = z.object({
	organizationId: z.string().min(1, 'Organization ID is required'),
	page: z.number().int().min(1).default(1).optional(),
	limit: z.number().int().min(1).max(100).default(20).optional()
});

export const folderIdSchema = z.object({
	folderId: z.string().min(1, 'Folder ID is required')
});

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

export type FolderCreateInput = z.infer<typeof folderCreateSchema>;
export type FolderUpdateInput = z.infer<typeof folderUpdateSchema>;
export type FolderListParams = z.infer<typeof folderListParamsSchema>;
export type FolderIdParam = z.infer<typeof folderIdSchema>;
