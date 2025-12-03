import { analytics } from '$lib/features/analytics/server';
import { auth } from '$lib/server/auth';
import { createContextLogger } from '$lib/server/logger';
import type { RequestEvent } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';

export function getBearerToken(request: Request) {
	const authorization = request.headers.get('Authorization');
	const token = authorization?.split(' ')[1];
	return token;
}

/**
 * #########
 * MIDDLEWARE
 * #########
 *
 * These are the middleware functions that are used to authenticate requests.
 * Credit-related functionality has been removed.
 */

export async function withAuth(
	event: RequestEvent<Record<string, string>>,
	handler: (orgId: string, siteId: string, apiKeyId: string) => Promise<Response>
): Promise<Response> {
	const logger = createContextLogger('api-middleware');
	const operation = logger.start('Authenticate API request', {
		endpoint: event.url.pathname,
		method: event.request.method
	});

	operation.step('Validating authorization header');
	const authHeader = event.request.headers.get('authorization');

	if (!authHeader) {
		operation.error('Authentication failed', undefined, {
			reason: 'auth header is missing',
			statusCode: 401
		});

		waitUntil(
			analytics
				.track('api_request_failed', {
					endpoint: event.url.pathname,
					method: event.request.method,
					statusCode: 401,
					error: 'UNAUTHORIZED',
					reason: 'auth header is missing'
				})
				.then(() => analytics.shutdown())
		);

		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication credentials'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	operation.step('Extracting bearer token');
	const token = authHeader.split(' ')[1];

	if (!token) {
		operation.error('Authentication failed', undefined, {
			reason: 'token is missing',
			statusCode: 401
		});

		waitUntil(
			analytics
				.track('api_request_failed', {
					endpoint: event.url.pathname,
					method: event.request.method,
					statusCode: 401,
					error: 'UNAUTHORIZED',
					reason: 'token is missing'
				})
				.then(() => analytics.shutdown())
		);

		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication credentials'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	/**
	 * API Keys are bound to users, but upon creation, we enforce applying keys to an
	 * organization ID and a site ID. Therefore, when verifying an API key, we can
	 * extract the organization ID from the key's metadata.
	 */
	operation.step('Verifying API key');
	const response = await auth.api.verifyApiKey({
		body: {
			key: token.trim()
		}
	});

	if (!response.valid) {
		operation.error('Authentication failed', undefined, {
			reason: response.error?.message || 'invalid token',
			code: response.error?.code,
			statusCode: 401
		});

		waitUntil(
			analytics
				.track('api_request_failed', {
					endpoint: event.url.pathname,
					method: event.request.method,
					statusCode: 401,
					error: 'UNAUTHORIZED',
					reason: response.error?.message || 'invalid token'
				})
				.then(() => analytics.shutdown())
		);

		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication credentials'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	operation.step('Extracting metadata from API key');
	const orgId = response.key?.metadata?.orgId;
	const siteId = response.key?.metadata?.siteId;
	const apiKeyId = response.key?.id;

	if (!orgId) {
		operation.error('Authentication failed', undefined, {
			reason: 'orgId is missing from API key metadata',
			statusCode: 401,
			apiKeyId
		});

		waitUntil(
			analytics
				.track('api_request_failed', {
					apiKeyId,
					endpoint: event.url.pathname,
					method: event.request.method,
					statusCode: 401,
					error: 'UNAUTHORIZED',
					reason: 'orgId is missing'
				})
				.then(() => analytics.shutdown())
		);

		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication credentials'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	if (!siteId) {
		operation.error('Authentication failed', undefined, {
			reason: 'siteId is missing from API key metadata',
			statusCode: 401,
			apiKeyId
		});

		waitUntil(
			analytics
				.track('api_request_failed', {
					apiKeyId,
					endpoint: event.url.pathname,
					method: event.request.method,
					statusCode: 401,
					error: 'UNAUTHORIZED',
					reason: 'siteId is missing'
				})
				.then(() => analytics.shutdown())
		);

		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication credentials'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	if (!apiKeyId) {
		operation.error('Authentication failed', undefined, {
			reason: 'apiKeyId is missing from verification response',
			statusCode: 401,
			organizationId: orgId
		});

		waitUntil(
			analytics
				.track('api_request_failed', {
					organizationId: orgId,
					endpoint: event.url.pathname,
					method: event.request.method,
					statusCode: 401,
					error: 'UNAUTHORIZED',
					reason: 'apiKeyId is missing'
				})
				.then(() => analytics.shutdown())
		);

		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication credentials'
			}),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	operation.end({
		organizationId: orgId,
		siteId,
		apiKeyId
	});

	waitUntil(
		analytics
			.track('api_request_authenticated', {
				organizationId: orgId,
				apiKeyId,
				endpoint: event.url.pathname,
				method: event.request.method
			})
			.then(() => analytics.shutdown())
	);

	return handler(orgId, siteId, apiKeyId);
}
