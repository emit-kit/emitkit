import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { schema } from '$lib/server/db';
import type { UserIdentity, UserIdentityInsert } from '$lib/server/db/schema';

// Upsert user identity (create if doesn't exist, update properties if exists)
// Uses composite unique constraint on (organizationId, userId)
export async function upsertIdentity(identity: UserIdentityInsert): Promise<UserIdentity> {
	const now = new Date();

	const [upserted] = await db
		.insert(schema.userIdentity)
		.values({
			...identity,
			createdAt: identity.createdAt ?? now,
			updatedAt: identity.updatedAt ?? now
		})
		.onConflictDoUpdate({
			target: [schema.userIdentity.organizationId, schema.userIdentity.userId],
			set: {
				properties: identity.properties,
				updatedAt: now
			}
		})
		.returning();

	if (!upserted) {
		throw new Error('Cannot upsert user identity');
	}

	return upserted;
}

export async function getIdentityByUserId(
	userId: string,
	orgId: string
): Promise<UserIdentity | null> {
	const identity = await db.query.userIdentity.findFirst({
		where: and(
			eq(schema.userIdentity.userId, userId),
			eq(schema.userIdentity.organizationId, orgId)
		)
	});

	return identity ?? null;
}

// Resolve a userId from either a direct userId or an alias
// Business Logic:
// 1. First check if it's a direct userId in userIdentity table
// 2. If not found, check if it's an alias in userAlias table
// 3. Return null if neither found
export async function resolveUserId(userIdOrAlias: string, orgId: string): Promise<string | null> {
	// First, check if it's a direct user_id in user_identities
	const identity = await db.query.userIdentity.findFirst({
		where: and(
			eq(schema.userIdentity.userId, userIdOrAlias),
			eq(schema.userIdentity.organizationId, orgId)
		)
	});

	if (identity) {
		return identity.userId;
	}

	// If not found, check if it's an alias
	const alias = await db.query.userAlias.findFirst({
		where: and(
			eq(schema.userAlias.alias, userIdOrAlias),
			eq(schema.userAlias.organizationId, orgId)
		)
	});

	if (alias) {
		return alias.userId;
	}

	// Not found
	return null;
}
