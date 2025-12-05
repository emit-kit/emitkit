<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import HashIcon from '@lucide/svelte/icons/hash';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { FolderActionsMenu } from '$lib/components/app/folder-actions';
	import FolderFavicon from '$lib/components/app/folder-favicon.svelte';
	import { listFoldersQuery, listDeletedFoldersQuery } from '$lib/features/folders/folders.remote';
	import { listChannelsByFolderQuery } from '$lib/features/channels/channels.remote';
	import { useCurrentOrganization } from 'better-auth-ui-svelte';
	import { useModals } from '$lib/components/modal-stack/modal-stack-provider.svelte';
	import type { Folder } from '$lib/features/folders/types';
	import type { Channel } from '$lib/server/db/schema/channel';

	const organization = useCurrentOrganization();
	const modals = useModals();

	// Reactive state for folders - we'll update this manually
	let foldersData = $state<Folder[]>([]);
	let deletedFoldersData = $state<Folder[]>([]);

	// Fetch folders and all channels when organization changes
	$effect(() => {
		if (organization.data?.id) {
			listFoldersQuery({ organizationId: organization.data.id, page: 1, limit: 50 }).then(
				async (data) => {
					foldersData = data.items;

					// Preload channels for all folders
					const channelPromises = data.items.map((folder) =>
						listChannelsByFolderQuery({ folderId: folder.id, page: 1, limit: 50 })
							.then((result) => ({ folderId: folder.id, channels: result.items }))
							.catch((error) => {
								console.error(`Failed to load channels for folder ${folder.id}:`, error);
								return { folderId: folder.id, channels: [] };
							})
					);

					const channelsResults = await Promise.all(channelPromises);

					// Update folderChannels state
					const newChannels: Record<string, { items: Channel[]; loading: boolean }> = {};
					for (const result of channelsResults) {
						newChannels[result.folderId] = { items: result.channels, loading: false };
					}
					folderChannels = newChannels;
				}
			);
			listDeletedFoldersQuery({ organizationId: organization.data.id, page: 1, limit: 50 }).then(
				(data) => {
					deletedFoldersData = data.items;
				}
			);
		}
	});

	// State to track which folders are open
	let openFolders = $state<Set<string>>(new Set());

	// State to track channels per folder
	let folderChannels = $state<Record<string, { items: Channel[]; loading: boolean }>>({});

	// Track if deleted folders section is open
	let showDeletedFolders = $state(false);

	// Helper function to refresh both active and deleted folders
	async function refreshFolders() {
		if (!organization.data?.id) return;

		const [activeFolders, archivedFolders] = await Promise.all([
			listFoldersQuery({ organizationId: organization.data.id, page: 1, limit: 50 }),
			listDeletedFoldersQuery({ organizationId: organization.data.id, page: 1, limit: 50 })
		]);

		foldersData = activeFolders.items;
		deletedFoldersData = archivedFolders.items;

		// Refresh channels for all active folders
		const channelPromises = activeFolders.items.map((folder) =>
			listChannelsByFolderQuery({ folderId: folder.id, page: 1, limit: 50 })
				.then((result) => ({ folderId: folder.id, channels: result.items }))
				.catch((error) => {
					console.error(`Failed to load channels for folder ${folder.id}:`, error);
					return { folderId: folder.id, channels: [] };
				})
		);

		const channelsResults = await Promise.all(channelPromises);

		// Update folderChannels state
		const newChannels: Record<string, { items: Channel[]; loading: boolean }> = {};
		for (const result of channelsResults) {
			newChannels[result.folderId] = { items: result.channels, loading: false };
		}
		folderChannels = newChannels;
	}

	// Toggle folder open/closed
	function toggleFolder(folderId: string) {
		if (openFolders.has(folderId)) {
			openFolders.delete(folderId);
			openFolders = new Set(openFolders);
		} else {
			openFolders.add(folderId);
			openFolders = new Set(openFolders);
		}
	}

	async function handleNewChannel(event: MouseEvent, folderId: string) {
		event.preventDefault();
		event.stopPropagation();

		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('channel', {
			props: {
				organizationId: organization.data.id,
				folderId: folderId
			}
		});

		const result = await modal.resolution;

		if (result && result.success && result.channelId) {
			const channelResult = await listChannelsByFolderQuery({
				folderId: folderId,
				page: 1,
				limit: 50
			});
			folderChannels[folderId] = { items: channelResult.items, loading: false };
		}
	}

	async function handleEditFolder(folderId: string, currentName: string, currentUrl: string | null) {
		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('editFolder', {
			props: {
				folderId: folderId,
				organizationId: organization.data.id,
				currentName: currentName,
				currentUrl: currentUrl
			}
		});

		const result = await modal.resolution;

		if (result && result.success) {
			// Refresh the folders list reactively
			await refreshFolders();
		}
	}

	async function handleDeleteFolder(folderId: string, folderName: string) {
		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('deleteFolder', {
			props: {
				folderId: folderId,
				organizationId: organization.data.id,
				folderName: folderName
			}
		});

		const result = await modal.resolution;

		if (result && result.success) {
			// Refresh the folders list after deletion - move to archived
			await refreshFolders();
		}
	}

	async function handleRestoreFolder(event: MouseEvent, folderId: string, folderName: string) {
		event.preventDefault();
		event.stopPropagation();

		if (!organization.data) {
			console.error('No organization selected');
			return;
		}

		const modal = modals.push('restoreFolder', {
			props: {
				folderId: folderId,
				organizationId: organization.data.id,
				folderName: folderName
			}
		});

		const result = await modal.resolution;

		if (result && result.success) {
			// Refresh the folders list after restoration - move back to active
			await refreshFolders();
		}
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Folders & Channels</Sidebar.GroupLabel>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#each foldersData as folder (folder.id)}
				<Collapsible.Root
					open={openFolders.has(folder.id)}
					onOpenChange={() => toggleFolder(folder.id)}
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
										<FolderFavicon url={folder.url} fallbackIcon={folder.icon} size="sm" />
										<span class="flex-1 text-left">{folder.name}</span>
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>

							<!-- Folder Actions Menu -->
							<FolderActionsMenu
								{folder}
								onEdit={handleEditFolder}
								onDelete={handleDeleteFolder}
							/>
						</div>
						<Collapsible.Content>
							<Sidebar.MenuSub>
								{#if folderChannels[folder.id]?.loading}
									<Sidebar.MenuSubItem>
										<span class="text-sm text-muted-foreground">Loading channels...</span>
									</Sidebar.MenuSubItem>
								{:else if folderChannels[folder.id]?.items?.length > 0}
									{#each folderChannels[folder.id].items as channel (channel.id)}
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubButton>
												{#snippet child({ props })}
													<a href="/events/{folder.id}/{channel.id}" {...props}>
														<HashIcon />
														<span>{channel.name}</span>
													</a>
												{/snippet}
											</Sidebar.MenuSubButton>
										</Sidebar.MenuSubItem>
									{/each}
								{:else if folderChannels[folder.id]}
									<Sidebar.MenuSubItem>
										<span class="text-sm text-muted-foreground">No channels yet</span>
									</Sidebar.MenuSubItem>
								{/if}

								<!-- Add Channel Button -->
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubButton
										class="text-sidebar-foreground/70"
										onclick={(e) => handleNewChannel(e, folder.id)}
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

			<!-- Archived Folders Section -->
			{#if deletedFoldersData.length > 0}
				<Collapsible.Root bind:open={showDeletedFolders} class="group/archived-collapsible mt-4">
					<Sidebar.MenuItem>
						<Collapsible.Trigger class="flex-1">
							{#snippet child({ props })}
								<Sidebar.MenuButton {...props} class="w-full text-muted-foreground">
									<ChevronRightIcon
										class="transition-transform duration-200 group-data-[state=open]/archived-collapsible:rotate-90"
									/>
									<FolderIcon class="size-4" />
									<span class="flex-1 text-left"
										>Archived Folders ({deletedFoldersData.length})</span
									>
								</Sidebar.MenuButton>
							{/snippet}
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Sidebar.MenuSub>
								{#each deletedFoldersData as folder (folder.id)}
									<Sidebar.MenuSubItem>
										<div class="flex w-full items-center gap-2">
											<div class="flex flex-1 items-center gap-2 opacity-60">
												<FolderFavicon url={folder.url} fallbackIcon={folder.icon} size="sm" />
												<span>{folder.name}</span>
											</div>
											<button
												type="button"
												class="rounded-md p-1 hover:bg-accent"
												onclick={(e) => handleRestoreFolder(e, folder.id, folder.name)}
												aria-label="Restore folder"
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
