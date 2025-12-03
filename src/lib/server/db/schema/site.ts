import { relations } from 'drizzle-orm';
import { pgTable, unique, index } from 'drizzle-orm/pg-core';
import { createBetterAuthId } from './utils';
import { organization } from './auth';
import { channel } from './channel';

export const site = pgTable(
	'site',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('site'))
			.notNull()
			.primaryKey(),
		organizationId: t
			.text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: t.varchar('name', { length: 255 }).notNull(),
		slug: t.varchar('slug', { length: 255 }).notNull(),
		icon: t.varchar('icon', { length: 50 }),
		description: t.text('description'),
		createdAt: t.timestamp('created_at').notNull().defaultNow(),
		updatedAt: t.timestamp('updated_at').notNull().defaultNow()
	}),
	(table) => ({
		uniqueOrgSlug: unique().on(table.organizationId, table.slug),
		idxOrg: index('idx_sites_org').on(table.organizationId)
	})
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const siteRelations = relations(site, ({ one, many }) => ({
	organization: one(organization, {
		fields: [site.organizationId],
		references: [organization.id]
	}),
	channels: many(channel)
}));

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type Site = typeof site.$inferSelect;
export type SiteInsert = typeof site.$inferInsert;
export type SiteUpdate = Partial<Omit<SiteInsert, 'organizationId'>>;
