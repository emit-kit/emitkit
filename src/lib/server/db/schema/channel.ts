import { relations } from 'drizzle-orm';
import { pgTable, index, unique } from 'drizzle-orm/pg-core';
import { createBetterAuthId } from './utils';
import { organization } from './auth';
import { folder } from './folder';
import { webhook } from './webhook';

export const channel = pgTable(
	'channel',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('channel'))
			.notNull()
			.primaryKey(),
		folderId: t
			.text('folder_id')
			.notNull()
			.references(() => folder.id, { onDelete: 'cascade' }),
		organizationId: t
			.text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		name: t.varchar('name', { length: 255 }).notNull(),
		icon: t.varchar('icon', { length: 50 }),
		description: t.text('description'),
		deletedAt: t.timestamp('deleted_at'),
		createdAt: t.timestamp('created_at').notNull().defaultNow(),
		updatedAt: t.timestamp('updated_at').notNull().defaultNow()
	}),
	(table) => ({
		uniqueFolderName: unique().on(table.folderId, table.name),
		idxFolder: index('idx_channels_folder').on(table.folderId),
		idxDeleted: index('idx_channels_deleted').on(table.deletedAt)
	})
);

export const channelRelations = relations(channel, ({ one, many }) => ({
	folder: one(folder, {
		fields: [channel.folderId],
		references: [folder.id]
	}),
	organization: one(organization, {
		fields: [channel.organizationId],
		references: [organization.id]
	}),
	webhooks: many(webhook)
}));

export type Channel = typeof channel.$inferSelect;
export type ChannelInsert = typeof channel.$inferInsert;
export type ChannelUpdate = Partial<Omit<ChannelInsert, 'folderId' | 'organizationId'>>;
