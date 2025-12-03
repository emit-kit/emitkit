import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { schema } from '$lib/server/db';
import type { UserAlias, UserAliasInsert } from '$lib/server/db/schema';

// Create a new alias for a user
// Note: Duplicate aliases will throw due to unique constraint on (organizationId, alias)
// Callers should handle this error gracefully
export async function createAlias(alias: UserAliasInsert): Promise<UserAlias> {
	const now = new Date();

	const [created] = await db
		.insert(schema.userAlias)
		.values({
			...alias,
			createdAt: alias.createdAt ?? now
		})
		.returning();

	if (!created) {
		throw new Error('Cannot create user alias');
	}

	return created;
}

export async function getAliasesByUserId(userId: string, orgId: string): Promise<UserAlias[]> {
	const aliases = await db.query.userAlias.findMany({
		where: and(eq(schema.userAlias.userId, userId), eq(schema.userAlias.organizationId, orgId)),
		orderBy: (aliases, { desc }) => [desc(aliases.createdAt)]
	});

	return aliases;
}

export async function deleteAlias(alias: string, orgId: string): Promise<void> {
	await db
		.delete(schema.userAlias)
		.where(and(eq(schema.userAlias.alias, alias), eq(schema.userAlias.organizationId, orgId)));
}
