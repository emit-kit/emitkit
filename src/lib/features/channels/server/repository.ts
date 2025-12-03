import { db, schema, type Channel, type ChannelInsert, type ChannelUpdate } from '$lib/server/db';
import { and, eq, sql } from 'drizzle-orm';
import {
	buildPaginatedQuery,
	type PaginatedQueryResult,
	type PaginationParams
} from '$lib/server/db/utils';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('channels');

export async function createChannel(channel: ChannelInsert): Promise<Channel> {
	const now = new Date();

	const [created] = await db
		.insert(schema.channel)
		.values({
			...channel,
			createdAt: channel.createdAt ?? now,
			updatedAt: channel.updatedAt ?? now
		})
		.returning();

	if (!created) {
		const error = new Error('Failed to create channel');
		logger.error('Channel creation failed', error, {
			organizationId: channel.organizationId,
			siteId: channel.siteId,
			name: channel.name
		});
		throw error;
	}

	logger.info('Channel created', {
		id: created.id,
		organizationId: created.organizationId,
		siteId: created.siteId,
		name: created.name
	});

	return created;
}

export async function getChannel(id: string): Promise<Channel | null> {
	const channel = await db.query.channel.findFirst({
		where: eq(schema.channel.id, id)
	});

	return channel ?? null;
}

export async function getChannelByIdAndOrg(id: string, orgId: string): Promise<Channel | null> {
	const channel = await db.query.channel.findFirst({
		where: and(eq(schema.channel.id, id), eq(schema.channel.organizationId, orgId))
	});

	return channel ?? null;
}

export async function getChannelByNameAndSite(
	name: string,
	siteId: string
): Promise<Channel | null> {
	const channel = await db.query.channel.findFirst({
		where: and(eq(schema.channel.name, name), eq(schema.channel.siteId, siteId))
	});

	return channel ?? null;
}

export async function getOrCreateChannel(
	name: string,
	siteId: string,
	organizationId: string,
	options?: {
		icon?: string;
		description?: string;
	}
): Promise<Channel> {
	// Try to find existing channel
	const existing = await getChannelByNameAndSite(name, siteId);
	if (existing) {
		logger.info('Channel found, reusing existing', {
			id: existing.id,
			name,
			siteId,
			organizationId
		});
		return existing;
	}

	// Create new channel
	logger.info('Channel not found, creating new', { name, siteId, organizationId });
	return await createChannel({
		siteId,
		organizationId,
		name,
		icon: options?.icon,
		description: options?.description
	});
}

export async function listChannels(
	orgId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Channel>> {
	const page = pagination?.page || 1;
	const limit = pagination?.limit || 20;
	const offset = (page - 1) * limit;

	// Build the main query
	const query = db.query.channel.findMany({
		where: eq(schema.channel.organizationId, orgId),
		orderBy: (channels, { desc }) => [desc(channels.createdAt)],
		limit,
		offset
	});

	// Build the count query
	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.channel)
		.where(eq(schema.channel.organizationId, orgId));

	// Execute both queries and build paginated result
	const result = await buildPaginatedQuery(query, countQuery, { page, limit });

	return result;
}

export async function listChannelsBySite(
	siteId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Channel>> {
	const page = pagination?.page || 1;
	const limit = pagination?.limit || 20;
	const offset = (page - 1) * limit;

	// Build the main query
	const query = db.query.channel.findMany({
		where: eq(schema.channel.siteId, siteId),
		orderBy: (channels, { desc }) => [desc(channels.createdAt)],
		limit,
		offset
	});

	// Build the count query
	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.channel)
		.where(eq(schema.channel.siteId, siteId));

	// Execute both queries and build paginated result
	const result = await buildPaginatedQuery(query, countQuery, { page, limit });

	return result;
}

export async function updateChannel(id: string, updates: ChannelUpdate): Promise<Channel> {
	const now = new Date();

	const [updated] = await db
		.update(schema.channel)
		.set({
			...updates,
			updatedAt: now
		})
		.where(eq(schema.channel.id, id))
		.returning();

	if (!updated) {
		const error = new Error('Failed to update channel');
		logger.error('Channel update failed', error, { id, updatedFields: Object.keys(updates) });
		throw error;
	}

	logger.info('Channel updated', {
		id: updated.id,
		updatedFields: Object.keys(updates),
		organizationId: updated.organizationId
	});

	return updated;
}

export async function deleteChannel(id: string): Promise<void> {
	await db.delete(schema.channel).where(eq(schema.channel.id, id));

	logger.info('Channel deleted', { id });
}
