import { relations } from 'drizzle-orm';
import { pgTable, index, unique } from 'drizzle-orm/pg-core';
import { createBetterAuthId } from './utils';
import { organization } from './auth';
import { site } from './site';
import { webhook } from './webhook';

export const channel = pgTable(
	'channel',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('channel'))
			.notNull()
			.primaryKey(),
		siteId: t
			.text('site_id')
			.notNull()
			.references(() => site.id, { onDelete: 'cascade' }),
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
		uniqueSiteName: unique().on(table.siteId, table.name),
		idxSite: index('idx_channels_site').on(table.siteId),
		idxDeleted: index('idx_channels_deleted').on(table.deletedAt)
	})
);

export const channelRelations = relations(channel, ({ one, many }) => ({
	site: one(site, {
		fields: [channel.siteId],
		references: [site.id]
	}),
	organization: one(organization, {
		fields: [channel.organizationId],
		references: [organization.id]
	}),
	webhooks: many(webhook)
}));

export type Channel = typeof channel.$inferSelect;
export type ChannelInsert = typeof channel.$inferInsert;
export type ChannelUpdate = Partial<Omit<ChannelInsert, 'siteId' | 'organizationId'>>;
