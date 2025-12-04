import type { PageServerLoad } from './$types';
import { listSitesByOrg } from '$lib/features/sites/server/repository';
import { listEventsByOrg } from '$lib/features/events/server';
import { listChannels } from '$lib/features/channels/server/repository';

export const load: PageServerLoad = async ({ locals, request }) => {
	const session = await locals.getSession({
		headers: request.headers
	});

	if (!session?.session?.activeOrganizationId) {
		return {
			sites: [],
			channels: [],
			events: {
				items: [],
				metadata: {
					page: 1,
					limit: 20,
					total: 0,
					totalPages: 0,
					hasNextPage: false,
					hasPreviousPage: false
				}
			}
		};
	}

	const orgId = session.session.activeOrganizationId;

	// Get sites, channels, and events for the organization in parallel
	const [sitesResult, channelsResult, eventsResult] = await Promise.all([
		listSitesByOrg(orgId, {
			page: 1,
			limit: 100 // Get all sites
		}),
		listChannels(orgId, {
			page: 1,
			limit: 100 // Get all channels for mapping
		}),
		listEventsByOrg(orgId, {
			page: 1,
			limit: 20
		})
	]);

	return {
		sites: sitesResult.items,
		channels: channelsResult.items,
		events: eventsResult,
		orgId
	};
};
