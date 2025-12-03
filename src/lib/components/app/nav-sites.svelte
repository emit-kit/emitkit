<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import HashIcon from '@lucide/svelte/icons/hash';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { listSitesQuery } from '$lib/features/sites/sites.remote';
	import { listChannelsBySiteQuery } from '$lib/features/channels/channels.remote';
	import { useCurrentOrganization } from 'better-auth-ui-svelte';
	import { useModals } from '$lib/components/modal-stack/modal-stack-provider.svelte';

	const organization = useCurrentOrganization();
	const modals = useModals();

	// Fetch all sites for the organization
	const sitesQuery = $derived.by(() => {
		if (!organization.data) {
			return Promise.resolve({ items: [], total: 0 });
		}

		return listSitesQuery({ organizationId: organization.data?.id, page: 1, limit: 50 });
	});

	// State to track which sites are open
	let openSites = $state<Set<string>>(new Set());

	// State to track channels per site
	let siteChannels = $state<Record<string, { items: any[]; loading: boolean }>>({});

	// Toggle site open/closed and fetch channels if needed
	async function toggleSite(siteId: string) {
		if (openSites.has(siteId)) {
			openSites.delete(siteId);
			openSites = new Set(openSites);
		} else {
			openSites.add(siteId);
			openSites = new Set(openSites);

			// Fetch channels if not already loaded
			if (!siteChannels[siteId]) {
				siteChannels[siteId] = { items: [], loading: true };

				try {
					const result = await listChannelsBySiteQuery({ siteId, page: 1, limit: 50 });
					siteChannels[siteId] = { items: result.items, loading: false };
				} catch (error) {
					console.error('Failed to load channels:', error);
					siteChannels[siteId] = { items: [], loading: false };
				}
			}
		}
	}

	async function handleNewChannel(event: MouseEvent, siteId: string) {
		event.preventDefault();
		event.stopPropagation();

		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('channel', {
			props: {
				organizationId: organization.data.id,
				siteId: siteId
			}
		});

		const result = await modal.resolution;

		if (result && result.success && result.channelId) {
			const channelResult = await listChannelsBySiteQuery({ siteId, page: 1, limit: 50 });
			siteChannels[siteId] = { items: channelResult.items, loading: false };
		}
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Sites & Channels</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#await sitesQuery then sites}
				{#each sites.items as site (site.id)}
					<Collapsible.Root
						open={openSites.has(site.id)}
						onOpenChange={() => toggleSite(site.id)}
						class="group/collapsible"
					>
						<Sidebar.MenuItem>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Sidebar.MenuButton {...props} class="w-full">
										<ChevronRightIcon
											class="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
										/>
										{#if site.icon}
											<span>{site.icon}</span>
										{:else}
											<FolderIcon class="size-4" />
										{/if}
										<span class="flex-1 text-left">{site.name}</span>
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>
							<Collapsible.Content>
								<Sidebar.MenuSub>
									{#if siteChannels[site.id]?.loading}
										<Sidebar.MenuSubItem>
											<span class="text-sm text-muted-foreground">Loading channels...</span>
										</Sidebar.MenuSubItem>
									{:else if siteChannels[site.id]?.items?.length > 0}
										{#each siteChannels[site.id].items as channel (channel.id)}
											<Sidebar.MenuSubItem>
												<Sidebar.MenuSubButton>
													{#snippet child({ props })}
														<a href="/{site.id}/{channel.id}" {...props}>
															<HashIcon />
															<span>{channel.name}</span>
														</a>
													{/snippet}
												</Sidebar.MenuSubButton>
											</Sidebar.MenuSubItem>
										{/each}
									{:else if siteChannels[site.id]}
										<Sidebar.MenuSubItem>
											<span class="text-sm text-muted-foreground">No channels yet</span>
										</Sidebar.MenuSubItem>
									{/if}

									<!-- Add Channel Button -->
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton
											class="text-sidebar-foreground/70"
											onclick={(e) => handleNewChannel(e, site.id)}
										>
											<PlusIcon />
											<span>New Channel</span>
										</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					</Collapsible.Root>
				{/each}
			{:catch error}
				<div class="text-red-500">Error loading sites: {error.message}</div>
			{/await}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
