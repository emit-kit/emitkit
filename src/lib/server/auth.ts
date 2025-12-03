import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from '$lib/server/db/index.js';
import {
	organization,
	magicLink,
	apiKey,
	type Organization,
	type Member
} from 'better-auth/plugins';
import {
	ac,
	admin as adminRole,
	member as memberRole,
	owner,
	viewer
} from '$lib/client/auth/permissions.js';
import { createBetterAuthId, site } from './db/schema';
import { analytics } from '$lib/features/analytics/server';
import { createId } from '@paralleldrive/cuid2';
import { createLogger } from '$lib/server/logger';
import { siteConfig } from './site-config';
import { env } from '$env/dynamic/private';
import { VERCEL_URL } from '$env/static/private';

const logger = createLogger('auth');

export const auth = betterAuth({
	baseURL: siteConfig.appUrl,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: schema
	}),
	emailAndPassword: {
		enabled: true
	},
	advanced: {
		database: {
			generateId: ({ model }) => {
				return createBetterAuthId(model);
			}
		}
	},
	socialProviders: {
		google: {
			clientId: '',
			clientSecret: ''
		}
	},
	plugins: [
		organization({
			ac, // Our access control instance
			roles: {
				owner,
				admin: adminRole,
				member: memberRole,
				viewer
			},
			dynamicAccessControl: {
				enabled: true // Enable dynamic role creation
			}
		}),
		// API Key plugin for site-scoped API tokens
		apiKey({
			defaultKeyLength: 16,
			startingCharactersConfig: {
				shouldStore: true,
				charactersLength: 4
			},
			enableMetadata: true,
			defaultPrefix: 'blip_',
			rateLimit: {
				enabled: true,
				timeWindow: 1000 * 60, // 1 minute
				maxRequests: 100 // 100 requests per minute default
			}
		}),
		// twoFactor(),
		magicLink({
			async sendMagicLink(data) {
				logger.info('Sending magic link', {
					url: data.url
				});
			}
		})
		// lastLoginMethod()
		// multiSession()
	],
	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					const firstOrg = await db.query.member.findFirst({
						where: (member, { eq }) => eq(member.userId, session.userId),
						with: {
							organization: {
								columns: {
									id: true,
									name: true,
									slug: true
								}
							}
						}
					});

					return {
						data: {
							...session,
							organization: firstOrg?.organization,
							activeOrganizationId: firstOrg?.organizationId
						}
					};
				}
			}
		},
		user: {
			create: {
				after: async (user) => {
					// Track user signup
					analytics.track(
						'user_signed_up',
						{
							userId: user.id,
							email: user.email,
							provider: undefined
						},
						{
							userId: user.email,
							user: {
								email: user.email
							}
						}
					);

					try {
						// Create a default organization for the new user
						const defaultOrg = await createDefaultOrganization(user);

						await createDefaultSite(defaultOrg);
					} catch (error) {
						logger.error(
							'Error creating default organization or site',
							error instanceof Error ? error : undefined,
							{
								userId: user.id,
								email: user.email
							}
						);
					}
				}
			}
		},
		organization: {
			create: {
				after: async (org: { id: string; name: string }) => {
					// Create a default site for the new organization
					await createDefaultSite(org);
				}
			}
		}
	},
	trustedOrigins(request) {
		logger.info('Getting trusted origins for request', {
			host: request.headers.get('host'),
			origin: request.headers.get('origin')
		});

		const origins = [
			`https://${VERCEL_URL}`,
			...(env.VERCEL_PROJECT_PRODUCTION_URL
				? [`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`]
				: []),
			...(env.VERCEL_BRANCH_URL ? [`https://${env.VERCEL_BRANCH_URL}`] : [])
		];

		logger.info('Trusted origins', { origins });

		return origins;
	}
});

async function createDefaultOrganization(
	user: Pick<typeof auth.$Infer.Session.user, 'id' | 'email' | 'name'>
) {
	const emailToName = (email: string) => {
		const atIndex = email.indexOf('@');
		if (atIndex === -1) return email;
		return email.slice(0, atIndex).toLowerCase();
	};
	const id = createId();
	const randomString = id.slice(0, 8);
	const name = user?.name ?? emailToName(user.email);

	const now = new Date();
	const trialEndsAt = new Date(now);
	trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 days from now

	const organization = await auth.api.createOrganization({
		body: {
			userId: user.id,
			name: 'Personal Workspace',
			slug: `personal-${name}-${randomString}`
		}
	});

	if (!organization) {
		throw new Error('Failed to create organization');
	}

	return organization;
}

async function createDefaultSite(org: { id: string; name: string }) {
	try {
		// Create the default site (without API key - will be created in onboarding)
		const [newSite] = await db
			.insert(site)
			.values({
				id: createBetterAuthId('site'),
				organizationId: org.id,
				name: 'Default Site',
				slug: 'default',
				description: 'Your first site - you can create more sites for different apps',
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning();

		if (!newSite) {
			logger.error('Failed to create default site for organization', undefined, {
				organizationId: org.id,
				organizationName: org.name
			});
			return;
		}

		logger.success('Created default site for organization', {
			organizationId: org.id,
			organizationName: org.name,
			siteId: newSite.id,
			message: 'API key will be created during user onboarding'
		});
	} catch (error) {
		logger.error('Error creating default site', error instanceof Error ? error : undefined, {
			organizationId: org.id,
			organizationName: org.name
		});
		// Don't throw - we don't want to break organization creation
	}
}

export type AuthConfig = typeof auth;
export type SessionObj = typeof auth.$Infer.Session;
export type UserObj = typeof auth.$Infer.Session.user;
export type OrganizationObj = Organization;
export type MemberObj = Member;

/**
 * Auth context for authenticated requests
 * Represents the authenticated user and their organization context
 */
export type AuthContext = {
	/** User's unique identifier */
	userId: string;
	/** Organization ID the user is operating within */
	organizationId: string | null;
	/** User's email address */
	email?: string;
	/** User's role within the organization */
	role?: string;
	/** Optional array of specific permissions */
	permissions?: string[];
};
