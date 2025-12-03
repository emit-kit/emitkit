import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { createContextLogger } from '$lib/server/logger';

/**
 * API Subdomain Handler
 * Handles requests from api.emitkit.com and rewrites them to /api/* routes
 */
const apiSubdomainHandler: Handle = async ({ event, resolve }) => {
	const logger = createContextLogger('api-subdomain-handler');
	const host = event.request.headers.get('host');

	// Only process requests from api.emitkit.com
	if (!host?.startsWith('api.')) {
		return resolve(event);
	}

	const originalPath = event.url.pathname;

	logger.info('API subdomain request received', {
		host,
		originalPath,
		startsWithV1: originalPath.startsWith('/v1/'),
		pathLength: originalPath.length,
		firstChar: originalPath[0],
		secondChar: originalPath[1]
	});

	// Only allow /v1/* paths on the API subdomain
	if (!originalPath.startsWith('/v1/')) {
		logger.warn('Invalid API subdomain path', {
			host,
			path: originalPath
		});

		return new Response(
			JSON.stringify({
				error: 'Not Found',
				message: `Invalid API endpoint. Only /v1/* paths are supported. Received: ${originalPath}`
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	// Rewrite /v1/* to /api/v1/*
	const rewrittenPath = `/api${originalPath}`;

	logger.info('Rewriting API subdomain request', {
		host,
		originalPath,
		rewrittenPath
	});

	// Create a new URL with the rewritten path and change host to avoid re-processing
	const rewrittenUrl = new URL(event.url);
	rewrittenUrl.pathname = rewrittenPath;
	rewrittenUrl.host = event.url.host.replace(/^api\./, 'app.');

	// Create a new request with the rewritten URL
	const rewrittenRequest = new Request(rewrittenUrl, {
		method: event.request.method,
		headers: event.request.headers,
		body: event.request.body
	});

	// Use fetch to internally call the rewritten route
	const response = await event.fetch(rewrittenRequest);

	return response;
};

const betterAuthHandler: Handle = async ({ event, resolve }) => {
	const logger = createContextLogger('auth-handler');

	event.locals.getSession = auth.api.getSession;
	event.locals.auth = auth;

	// For API subdomain requests (api.emitkit.com), skip session/org logic - authentication handled by API key middleware
	const host = event.request.headers.get('host');
	if (host?.startsWith('api.')) {
		return resolve(event);
	}

	// For Better Auth API routes, skip session/org logic and let svelteKitHandler handle it directly
	if (event.url.pathname.startsWith('/api/auth')) {
		return svelteKitHandler({ event, resolve, auth, building });
	}

	// For public API routes (v1), skip session/org logic - authentication handled by API key middleware
	if (event.url.pathname.startsWith('/api/v1')) {
		return resolve(event);
	}

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const [member, activeOrg] = await Promise.all([
		event.locals.session?.activeOrganizationId
			? auth.api.getActiveMember({ headers: event.request.headers })
			: Promise.resolve(null),
		event.locals.session?.activeOrganizationId
			? db.query.organization.findFirst({
					where: (organization, { eq }) =>
						eq(organization.id, event.locals.session?.activeOrganizationId ?? '')
				})
			: Promise.resolve(null)
	]);

	// Handle invalid or missing activeOrganizationId
	if (
		event.locals.session &&
		(!event.locals.session?.activeOrganizationId || !activeOrg || !member)
	) {
		// Check if we need to validate the member relationship
		// Sometimes after invitation acceptance, there might be a timing issue
		if (event.locals.session?.activeOrganizationId && !member) {
			// Try to fetch the member record directly from the database
			const directMember = await db.query.member.findFirst({
				where: (m, { and, eq }) =>
					and(
						eq(m.userId, event.locals.session?.userId ?? ''),
						eq(m.organizationId, event.locals.session?.activeOrganizationId ?? '')
					)
			});

			if (directMember) {
				// Member exists in DB but wasn't loaded properly, update locals
				event.locals.activeOrganizationMember = directMember;
				event.locals.activeOrganization = activeOrg ?? undefined;
			} else {
				// Member doesn't exist, need to reset to a valid organization
				logger.info('User not a member of active organization, resetting to first available', {
					userId: event.locals.session.userId,
					attemptedOrgId: event.locals.session.activeOrganizationId
				});

				// Find first valid organization
				const firstOrg = await db.query.member.findFirst({
					where: (member, { eq }) => eq(member.userId, event.locals.session?.userId ?? ''),
					with: {
						organization: true
					}
				});

				if (firstOrg) {
					await auth.api.setActiveOrganization({
						headers: event.request.headers,
						body: {
							organizationId: firstOrg.organizationId
						}
					});

					event.locals.session.activeOrganizationId = firstOrg.organizationId;
					event.locals.activeOrganization = firstOrg.organization;
					event.locals.activeOrganizationMember = firstOrg;
				} else {
					// User has no organizations at all - clear the invalid activeOrganizationId
					event.locals.session.activeOrganizationId = undefined;
					event.locals.activeOrganization = undefined;
					event.locals.activeOrganizationMember = undefined;
				}
			}
		} else if (!event.locals.session?.activeOrganizationId) {
			// No active organization set, find first available
			const firstOrg = await db.query.member.findFirst({
				where: (member, { eq }) => eq(member.userId, event.locals.session?.userId ?? ''),
				with: {
					organization: true
				}
			});

			if (firstOrg) {
				await auth.api.setActiveOrganization({
					headers: event.request.headers,
					body: {
						organizationId: firstOrg.organizationId
					}
				});

				event.locals.session.activeOrganizationId = firstOrg.organizationId;
				event.locals.activeOrganization = firstOrg.organization;
				event.locals.activeOrganizationMember = firstOrg;
			}
		}
	} else {
		event.locals.activeOrganization = activeOrg ?? undefined;
		event.locals.activeOrganizationMember = member ?? undefined;
	}

	// CRITICAL: If user has a session but no active organization, something went wrong
	// Every user should have a default organization created during signup
	if (event.locals.session && !event.locals.activeOrganization) {
		logger.error('CRITICAL: Authenticated user has no active organization', undefined, {
			userId: event.locals.session.userId,
			sessionId: event.locals.session.id,
			activeOrganizationId: event.locals.session.activeOrganizationId,
			timestamp: new Date().toISOString()
		});
		throw new Error(
			'User authentication is in an invalid state. No organization found for authenticated user. This should never happen as users are assigned a default organization during signup.'
		);
	}

	if (event.locals.session && event.locals.user) {
		event.locals.authContext = {
			userId: event.locals.user.id,
			organizationId: event.locals.session.activeOrganizationId ?? null,
			role: event.locals.activeOrganizationMember?.role ?? 'member',
			email: event.locals.user.email
		};
	}

	// svelteKitHandler internally handles Better Auth routes and passes through others
	return svelteKitHandler({ event, resolve, auth, building });
};

const guardHandler: Handle = async ({ event, resolve }) => {
	const logger = createContextLogger('guard-handler');

	// Allow API subdomain requests (api.emitkit.com) - authentication handled by route-specific middleware
	const host = event.request.headers.get('host');
	if (host?.startsWith('api.')) {
		return resolve(event);
	}

	// Allow auth routes to be accessible without session
	if (event.url.pathname.startsWith('/auth')) {
		// If user has session and tries to access sign-in or sign-up, redirect to root
		if (
			event.locals.session &&
			(event.url.pathname === '/auth/sign-in' || event.url.pathname === '/auth/sign-up')
		) {
			logger.info('User with session trying to access auth route, redirecting to root', {
				userId: event.locals.session.userId,
				path: event.url.pathname
			});
			redirect(302, '/');
		}
		// Otherwise allow access to auth routes (sign-in, sign-up, reset password, etc.)
		return resolve(event);
	}

	// Allow API routes (authentication handled by route-specific middleware)
	// - /api/auth: Better Auth routes (session-based)
	// - /api/v1: Public API routes (API key-based via withAuth middleware)
	if (event.url.pathname.startsWith('/api')) {
		return resolve(event);
	}

	// For all non-auth routes, require a session
	if (!event.locals.session) {
		redirect(302, '/auth/sign-in');
	}

	// CRITICAL: Ensure active organization exists for all protected routes
	// This should never fail due to the check in betterAuthHandler
	if (!event.locals.activeOrganization) {
		logger.error(
			'CRITICAL: Guard handler - authenticated user has no active organization',
			undefined,
			{
				userId: event.locals.session.userId,
				path: event.url.pathname,
				timestamp: new Date().toISOString()
			}
		);
		throw new Error('Cannot access protected routes without an active organization');
	}

	return resolve(event);
};

export const handle = sequence(apiSubdomainHandler, betterAuthHandler, guardHandler);
