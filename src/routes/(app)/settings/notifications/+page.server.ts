import type { PageServerLoad } from './$types';
import { listSitesByOrg } from '$lib/features/sites/server/repository';
import { listChannelsBySite } from '$lib/features/channels/server/repository';
import { getUserPushSubscriptions } from '$lib/features/notifications/server';
import type { SiteWithChannels } from '$lib/features/notifications/types';
import type { Site } from '$lib/features/sites/types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		throw new Error('Unauthorized');
	}

	// Fetch all sites for this organization
	const sitesResult = await listSitesByOrg(activeOrganization.id, { page: 1, limit: 100 });

	// Fetch channels for each site
	const sitesWithChannels: SiteWithChannels[] = await Promise.all(
		sitesResult.items.map(async (site: Site) => {
			const channelsResult = await listChannelsBySite(site.id, { page: 1, limit: 100 });
			return {
				...site,
				channels: channelsResult.items
			};
		})
	);

	// Get user's current push subscriptions
	const subscriptions = await getUserPushSubscriptions(user.id);
	const currentSubscription = subscriptions[0] || null; // Use first subscription for this device

	return {
		sites: sitesWithChannels,
		currentSubscription,
		organizationId: activeOrganization.id,
		userId: user.id
	};
};
