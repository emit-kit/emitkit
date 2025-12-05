import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { integration } from '$lib/server/db/schema';

export const selectIntegrationSchema = createSelectSchema(integration);
export const insertIntegrationSchema = createInsertSchema(integration);
