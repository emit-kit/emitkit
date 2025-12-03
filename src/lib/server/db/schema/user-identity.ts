import { relations } from 'drizzle-orm';
import { pgTable, timestamp, varchar, json, index, unique } from 'drizzle-orm/pg-core';
import { createBetterAuthId } from './utils';
import { organization } from './auth';

export const userIdentity = pgTable(
	'user_identity',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('user_identity'))
			.notNull()
			.primaryKey(),
		organizationId: t
			.text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		userId: t.varchar('user_id', { length: 255 }).notNull(),
		properties: t.json('properties').$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: t.timestamp('created_at').notNull().defaultNow(),
		updatedAt: t.timestamp('updated_at').notNull().defaultNow()
	}),
	(table) => ({
		uniqueOrgUserId: unique().on(table.organizationId, table.userId)
	})
);

export const userAlias = pgTable(
	'user_alias',
	(t) => ({
		id: t
			.text('id')
			.$defaultFn(() => createBetterAuthId('user_alias'))
			.notNull()
			.primaryKey(),
		organizationId: t
			.text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		userId: t.varchar('user_id', { length: 255 }).notNull(),
		alias: t.varchar('alias', { length: 255 }).notNull(),
		createdAt: t.timestamp('created_at').notNull().defaultNow()
	}),
	(table) => ({
		uniqueOrgAlias: unique().on(table.organizationId, table.alias),
		idxAlias: index('idx_user_aliases_alias').on(table.organizationId, table.alias)
	})
);

export const userIdentityRelations = relations(userIdentity, ({ one, many }) => ({
	organization: one(organization, {
		fields: [userIdentity.organizationId],
		references: [organization.id]
	}),
	aliases: many(userAlias)
}));

export const userAliasRelations = relations(userAlias, ({ one }) => ({
	organization: one(organization, {
		fields: [userAlias.organizationId],
		references: [organization.id]
	})
}));

export type UserIdentity = typeof userIdentity.$inferSelect;
export type UserIdentityInsert = typeof userIdentity.$inferInsert;

export type UserAlias = typeof userAlias.$inferSelect;
export type UserAliasInsert = typeof userAlias.$inferInsert;
