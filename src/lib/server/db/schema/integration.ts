import { relations, sql } from 'drizzle-orm';
import { pgTable, index } from 'drizzle-orm/pg-core';
import { createBetterAuthId } from './utils';
import { organization } from './auth';
import { channel } from './channel';
import { folder } from './folder';

export const integration = pgTable(
	'integration',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('integration'))
			.notNull()
			.primaryKey(),
		organizationId: t
			.text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),

		// Scope: Defines subscription level (organization, folder, or channel)
		scope: t.text('scope', { enum: ['organization', 'folder', 'channel'] }).notNull(),

		// Scope-specific references (nullable, enforced by check constraint in migration)
		folderId: t.text('folder_id').references(() => folder.id, { onDelete: 'cascade' }),
		channelId: t.text('channel_id').references(() => channel.id, { onDelete: 'cascade' }),

		// Integration type: 'slack', 'discord', 'email', 'teams', etc.
		type: t.text('type').notNull(),

		enabled: t.boolean('enabled').default(true).notNull(),

		// Type-specific configuration (JSON for flexibility)
		config: t
			.json('config')
			.$type<{
				webhookUrl?: string;
				apiKey?: string;
				channelId?: string;
				email?: string;
				[key: string]: unknown;
			}>()
			.notNull(),

		// Event filtering within scope
		eventFilters: t
			.json('event_filters')
			.$type<{
				eventTypes?: string[]; // ['user_signup', 'payment_completed'] or ['all']
				tags?: string[]; // Only events with these tags
				severityMin?: 'low' | 'medium' | 'high' | 'critical'; // Future use
				customConditions?: Record<string, unknown>; // Future use
			}>()
			.default({ eventTypes: ['all'] })
			.notNull(),

		createdAt: t.timestamp('created_at').notNull().defaultNow(),
		updatedAt: t.timestamp('updated_at').notNull().defaultNow()
	}),
	(table) => ({
		// Indexes for efficient queries at all scope levels
		idxOrgEnabled: index('idx_integrations_org_enabled')
			.on(table.organizationId, table.enabled)
			.where(sql`${table.enabled} = true`),
		idxFolderEnabled: index('idx_integrations_folder_enabled')
			.on(table.folderId)
			.where(sql`${table.enabled} = true AND ${table.scope} = 'folder'`),
		idxChannelEnabled: index('idx_integrations_channel_enabled')
			.on(table.channelId)
			.where(sql`${table.enabled} = true AND ${table.scope} = 'channel'`)
	})
);

export const integrationRelations = relations(integration, ({ one }) => ({
	organization: one(organization, {
		fields: [integration.organizationId],
		references: [organization.id]
	}),
	folder: one(folder, {
		fields: [integration.folderId],
		references: [folder.id]
	}),
	channel: one(channel, {
		fields: [integration.channelId],
		references: [channel.id]
	})
}));

export type Integration = typeof integration.$inferSelect;
export type IntegrationInsert = typeof integration.$inferInsert;
