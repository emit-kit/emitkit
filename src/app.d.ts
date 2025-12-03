import type {
	AuthConfig,
	SessionObj,
	UserObj,
	AuthContext,
	OrganizationObj,
	auth
} from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			auth: typeof auth;
			user?: UserObj;
			session?: SessionObj['session'];
			activeOrganization?: OrganizationObj;
			activeOrganizationMember?: LocalMember;
			getSession: AuthConfig['api']['getSession'];
			authContext?: AuthContext;
			requestId?: string;
		}
		interface PageData {
			orgId: string;
		}
		interface Platform {
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
