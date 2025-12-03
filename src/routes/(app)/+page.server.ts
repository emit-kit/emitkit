import type { PageServerLoad } from './$types';
import { listSitesByOrg } from '$lib/features/sites/server/repository';

export const load: PageServerLoad = async ({ locals, request }) => {
	const session = await locals.getSession({
		headers: request.headers
	});

	if (!session?.session?.activeOrganizationId) {
		return {
			sites: []
		};
	}

	// Get sites for the organization
	const sitesResult = await listSitesByOrg(session.session.activeOrganizationId, {
		page: 1,
		limit: 10
	});

	return {
		sites: sitesResult.items
	};
};
