import { relations } from 'drizzle-orm';
import { pgTable, unique, index } from 'drizzle-orm/pg-core';
import { createBetterAuthId } from './utils';
import { organization } from './auth';
import { channel } from './channel';

export const folder = pgTable(
	'folder',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('folder'))
			.notNull()
			.primaryKey(),
		organizationId: t
			.text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: t.varchar('name', { length: 255 }).notNull(),
		slug: t.varchar('slug', { length: 255 }).notNull(),
		url: t.varchar('url', { length: 500 }),
		icon: t.varchar('icon', { length: 50 }),
		description: t.text('description'),
		deletedAt: t.timestamp('deleted_at'),
		createdAt: t.timestamp('created_at').notNull().defaultNow(),
		updatedAt: t.timestamp('updated_at').notNull().defaultNow()
	}),
	(table) => ({
		uniqueOrgSlug: unique().on(table.organizationId, table.slug),
		idxOrg: index('idx_folders_org').on(table.organizationId),
		idxDeleted: index('idx_folders_deleted').on(table.deletedAt)
	})
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const folderRelations = relations(folder, ({ one, many }) => ({
	organization: one(organization, {
		fields: [folder.organizationId],
		references: [organization.id]
	}),
	channels: many(channel)
}));

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type Folder = typeof folder.$inferSelect;
export type FolderInsert = typeof folder.$inferInsert;
export type FolderUpdate = Partial<Omit<FolderInsert, 'organizationId'>>;
