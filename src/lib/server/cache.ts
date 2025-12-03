import { redis } from '$lib/server/redis';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('cache');

export interface CacheConfig {
	/** Time-to-live in seconds */
	ttl: number;
	/** Function to generate cache key from parameters */
	keyGenerator: (params: Record<string, unknown>) => string;
	/** Optional prefix for the cache key */
	prefix?: string;
}

/**
 * Cache wrapper with automatic serialization and TTL management
 *
 * @param cacheKey - Unique cache key
 * @param ttl - Time-to-live in seconds
 * @param fetcher - Function to fetch data if cache misses
 * @returns Cached or freshly fetched data
 */
export async function withCache<T>(
	cacheKey: string,
	ttl: number,
	fetcher: () => Promise<T>
): Promise<T> {
	try {
		// Try cache first
		const cached = await redis.get(cacheKey);
		if (cached !== null) {
			logger.info('Cache hit', { key: cacheKey });
			return JSON.parse(cached as string) as T;
		}

		logger.info('Cache miss', { key: cacheKey });
	} catch (error) {
		// Log cache read errors but don't fail the request
		logger.error('Cache read error', error instanceof Error ? error : undefined, {
			key: cacheKey
		});
	}

	// Cache miss - fetch from source
	const data = await fetcher();

	// Store in cache (non-blocking, fire-and-forget)
	redis.setex(cacheKey, ttl, JSON.stringify(data)).catch((error) => {
		logger.error('Cache write error', error instanceof Error ? error : undefined, {
			key: cacheKey,
			ttl
		});
	});

	return data;
}

export async function invalidateCache(cacheKey: string): Promise<void> {
	try {
		await redis.del(cacheKey);
		logger.info('Cache invalidated', { key: cacheKey });
	} catch (error) {
		logger.error('Cache invalidation error', error instanceof Error ? error : undefined, {
			key: cacheKey
		});
	}
}

/**
 * Invalidate multiple cache keys by pattern
 * WARNING: Uses SCAN, may be slow for large keyspaces
 *
 * @param pattern - Redis pattern (e.g., "events:ch_123:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
	try {
		// Upstash Redis doesn't support SCAN, so we'll need to track keys explicitly
		// For now, log a warning
		logger.warn('Pattern-based invalidation not fully supported with Upstash', {
			pattern
		});

		// Alternative: Store key patterns in a set and invalidate from there
		// For MVP, we'll invalidate specific known keys
	} catch (error) {
		logger.error('Cache pattern invalidation error', error instanceof Error ? error : undefined, {
			pattern
		});
	}
}

export async function invalidateChannelCache(channelId: string): Promise<void> {
	const keys = [
		`events:channel:${channelId}:list`,
		`events:channel:${channelId}:realtime`,
		`events:channel:${channelId}:stats`
	];

	await Promise.allSettled(keys.map((key) => invalidateCache(key)));
	logger.info('Channel cache invalidated', { channelId, keys: keys.length });
}

export async function invalidateOrganizationCache(organizationId: string): Promise<void> {
	const keys = [`events:org:${organizationId}:list`, `events:org:${organizationId}:stats`];

	await Promise.allSettled(keys.map((key) => invalidateCache(key)));
	logger.info('Organization cache invalidated', { organizationId, keys: keys.length });
}

/**
 * Generate a deterministic cache key from parameters
 *
 * @param prefix - Key prefix (e.g., "events:channel")
 * @param params - Parameters to include in key
 * @returns Cache key string
 */
export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
	// Sort keys for deterministic keys
	const sortedParams = Object.keys(params)
		.sort()
		.map((key) => `${key}:${params[key]}`)
		.join(':');

	return `${prefix}:${sortedParams}`;
}

export async function publishToChannel(
	channel: string,
	data: Record<string, unknown>
): Promise<void> {
	try {
		await redis.publish(channel, JSON.stringify(data));
		logger.info('Published to channel', { channel });
	} catch (error) {
		logger.error('Publish error', error instanceof Error ? error : undefined, {
			channel
		});
	}
}
