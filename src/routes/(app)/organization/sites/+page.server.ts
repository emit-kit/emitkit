import type { PageServerLoad } from './$types';
import { listSitesByOrg } from '$lib/features/sites/server/repository';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.activeOrganization || !locals.user) {
		throw redirect(302, '/');
	}

	// Get all sites for the organization
	const sitesResult = await listSitesByOrg(locals.activeOrganization.id, {
		page: 1,
		limit: 100
	});

	return {
		sites: sitesResult.items,
		organizationId: locals.activeOrganization.id,
		userId: locals.user.id
	};
};
