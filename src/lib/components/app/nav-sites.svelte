<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import HashIcon from '@lucide/svelte/icons/hash';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { SiteActionsMenu } from '$lib/components/app/site-actions';
	import { listSitesQuery, listDeletedSitesQuery } from '$lib/features/sites/sites.remote';
	import { listChannelsBySiteQuery } from '$lib/features/channels/channels.remote';
	import { useCurrentOrganization } from 'better-auth-ui-svelte';
	import { useModals } from '$lib/components/modal-stack/modal-stack-provider.svelte';
	import type { Site } from '$lib/server/db/schema/site';
	import type { Channel } from '$lib/server/db/schema/channel';

	const organization = useCurrentOrganization();
	const modals = useModals();

	// Reactive state for sites - we'll update this manually
	let sitesData = $state<Site[]>([]);
	let deletedSitesData = $state<Site[]>([]);

	// Fetch sites when organization changes
	$effect(() => {
		if (organization.data?.id) {
			listSitesQuery({ organizationId: organization.data.id, page: 1, limit: 50 }).then(
				(data) => {
					sitesData = data.items;
				}
			);
			listDeletedSitesQuery({ organizationId: organization.data.id, page: 1, limit: 50 }).then(
				(data) => {
					deletedSitesData = data.items;
				}
			);
		}
	});

	// State to track which sites are open
	let openSites = $state<Set<string>>(new Set());

	// State to track channels per site
	let siteChannels = $state<Record<string, { items: Channel[]; loading: boolean }>>({});

	// Track if deleted sites section is open
	let showDeletedSites = $state(false);

	// Helper function to refresh both active and deleted sites
	async function refreshSites() {
		if (!organization.data?.id) return;

		const [activeSites, archivedSites] = await Promise.all([
			listSitesQuery({ organizationId: organization.data.id, page: 1, limit: 50 }),
			listDeletedSitesQuery({ organizationId: organization.data.id, page: 1, limit: 50 })
		]);

		sitesData = activeSites.items;
		deletedSitesData = archivedSites.items;
	}

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

	async function handleRenameSite(siteId: string, currentName: string) {
		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('renameSite', {
			props: {
				siteId: siteId,
				organizationId: organization.data.id,
				currentName: currentName
			}
		});

		const result = await modal.resolution;

		if (result && result.success) {
			// Refresh the sites list reactively
			await refreshSites();
		}
	}

	async function handleDeleteSite(siteId: string, siteName: string) {
		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('deleteSite', {
			props: {
				siteId: siteId,
				organizationId: organization.data.id,
				siteName: siteName
			}
		});

		const result = await modal.resolution;

		if (result && result.success) {
			// Refresh the sites list after deletion - move to archived
			await refreshSites();
		}
	}

	async function handleRestoreSite(event: MouseEvent, siteId: string, siteName: string) {
		event.preventDefault();
		event.stopPropagation();

		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('restoreSite', {
			props: {
				siteId: siteId,
				organizationId: organization.data.id,
				siteName: siteName
			}
		});

		const result = await modal.resolution;

		if (result && result.success) {
			// Refresh the sites list after restoration - move back to active
			await refreshSites();
		}
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Sites & Channels</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#each sitesData as site (site.id)}
					<Collapsible.Root
						open={openSites.has(site.id)}
						onOpenChange={() => toggleSite(site.id)}
						class="group/collapsible"
					>
						<Sidebar.MenuItem>
							<div class="flex w-full items-center gap-1">
								<Collapsible.Trigger class="flex-1">
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

								<!-- Site Actions Menu -->
								<SiteActionsMenu
									{site}
									onRename={handleRenameSite}
									onDelete={handleDeleteSite}
								/>
							</div>
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
														<a href="/events/{site.id}/{channel.id}" {...props}>
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

			<!-- Archived Sites Section -->
			{#if deletedSitesData.length > 0}
					<Collapsible.Root bind:open={showDeletedSites} class="group/archived-collapsible mt-4">
						<Sidebar.MenuItem>
							<Collapsible.Trigger class="flex-1">
								{#snippet child({ props })}
									<Sidebar.MenuButton {...props} class="w-full text-muted-foreground">
										<ChevronRightIcon
											class="transition-transform duration-200 group-data-[state=open]/archived-collapsible:rotate-90"
										/>
										<FolderIcon class="size-4" />
										<span class="flex-1 text-left">Archived Sites ({deletedSitesData.length})</span>
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>
							<Collapsible.Content>
								<Sidebar.MenuSub>
									{#each deletedSitesData as site (site.id)}
										<Sidebar.MenuSubItem>
											<div class="flex w-full items-center gap-1">
												<div class="flex-1 opacity-60">
													{#if site.icon}
														<span class="mr-2">{site.icon}</span>
													{/if}
													<span>{site.name}</span>
												</div>
												<button
													type="button"
													class="rounded-md p-1 hover:bg-accent"
													onclick={(e) => handleRestoreSite(e, site.id, site.name)}
													aria-label="Restore site"
												>
													<span class="text-xs">Restore</span>
												</button>
											</div>
										</Sidebar.MenuSubItem>
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					</Collapsible.Root>
			{/if}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
