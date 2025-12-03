import { z } from 'zod';

export const siteCreateSchema = z.object({
	organizationId: z.string().min(1, 'Organization ID is required'),
	name: z.string().min(1, 'Site name is required').max(255, 'Site name is too long'),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(255, 'Slug is too long')
		.regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
	icon: z.string().max(50).optional(),
	description: z.string().optional()
});

export const siteUpdateSchema = z.object({
	name: z.string().min(1, 'Site name is required').max(255, 'Site name is too long').optional(),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(255, 'Slug is too long')
		.regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
		.optional(),
	icon: z.string().max(50).optional(),
	description: z.string().optional()
});

export const siteListParamsSchema = z.object({
	organizationId: z.string().min(1, 'Organization ID is required'),
	page: z.number().int().min(1).default(1).optional(),
	limit: z.number().int().min(1).max(100).default(20).optional()
});

export const siteIdSchema = z.object({
	siteId: z.string().min(1, 'Site ID is required')
});

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

export type SiteCreateInput = z.infer<typeof siteCreateSchema>;
export type SiteUpdateInput = z.infer<typeof siteUpdateSchema>;
export type SiteListParams = z.infer<typeof siteListParamsSchema>;
export type SiteIdParam = z.infer<typeof siteIdSchema>;
