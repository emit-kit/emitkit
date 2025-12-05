<script lang="ts">
	import type { StackItemProps } from '@svelte-put/async-stack';
	import { createIntegrationCommand } from '$lib/features/integrations/integrations.remote';
	import { listFoldersQuery } from '$lib/features/folders/folders.remote';
	import { listChannelsByFolderQuery } from '$lib/features/channels/channels.remote';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import * as Select from '$lib/components/ui/select';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import { toast } from 'svelte-sonner';

	interface Props {
		organizationId: string;
		channelId?: string;
		folderId?: string;
	}

	let {
		item,
		organizationId,
		channelId,
		folderId
	}: StackItemProps<{ confirmed: boolean; integrationId?: string }> & Props = $props();

	// Form state
	let scope = $state<'organization' | 'folder' | 'channel'>(
		channelId ? 'channel' : folderId ? 'folder' : 'organization'
	);
	let selectedFolderId = $state<string | undefined>(folderId);
	let selectedChannelId = $state<string | undefined>(channelId);
	let webhookUrl = $state('');
	let allEventTypes = $state(true);
	let tags = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Fetch folders when scope is 'folder' or 'channel'
	const foldersQuery = $derived(
		(scope === 'folder' || scope === 'channel') && organizationId
			? listFoldersQuery({ organizationId, page: 1, limit: 50 })
			: null
	);

	// Fetch channels when scope is 'channel' and a folder is selected
	const channelsQuery = $derived(
		scope === 'channel' && selectedFolderId
			? listChannelsByFolderQuery({ folderId: selectedFolderId, page: 1, limit: 50 })
			: null
	);

	// Reset selectedChannelId when selectedFolderId changes
	let previousFolderId = $state<string | undefined>(undefined);
	$effect(() => {
		if (selectedFolderId !== previousFolderId) {
			if (previousFolderId !== undefined) {
				selectedChannelId = undefined;
			}
			previousFolderId = selectedFolderId;
		}
	});

	// Validation
	const isValid = $derived(
		webhookUrl.trim() !== '' &&
			isValidUrl(webhookUrl) &&
			(scope === 'organization' ||
				(scope === 'folder' && selectedFolderId) ||
				(scope === 'channel' && selectedFolderId && selectedChannelId))
	);

	function isValidUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function handleCancel() {
		item.resolve({ confirmed: false });
	}

	async function handleSubmit() {
		if (!isValid) return;

		isSubmitting = true;
		error = null;

		try {
			// Parse tags
			const tagArray = tags
				.split(',')
				.map((t) => t.trim())
				.filter((t) => t.length > 0);

			// Build payload
			const payload: {
				scope: 'organization' | 'folder' | 'channel';
				type: 'slack';
				config: { webhookUrl: string };
				organizationId?: string;
				folderId?: string;
				channelId?: string;
				eventFilters?: { eventTypes: string[]; tags?: string[] };
			} = {
				scope,
				type: 'slack',
				config: { webhookUrl: webhookUrl.trim() }
			};

			// Add scope-specific fields
			if (scope === 'organization') {
				// No additional fields needed
			} else if (scope === 'folder') {
				if (!selectedFolderId) {
					throw new Error('Please select a folder');
				}
				payload.folderId = selectedFolderId;
			} else if (scope === 'channel') {
				if (!selectedFolderId || !selectedChannelId) {
					throw new Error('Please select both folder and channel');
				}
				payload.channelId = selectedChannelId;
				payload.folderId = selectedFolderId;
			}

			// Add event filters
			payload.eventFilters = {
				eventTypes: allEventTypes ? ['all'] : [],
				...(tagArray.length > 0 && { tags: tagArray })
			};

			const result = await createIntegrationCommand(payload);

			if (result.success) {
				toast.success('Slack integration connected successfully');
				item.resolve({ confirmed: true, integrationId: result.integration.id });
			} else {
				throw new Error('Failed to create integration');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to connect Slack integration';
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root open={true}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Connect Slack</Dialog.Title>
			<Dialog.Description>
				Configure Slack webhook to receive event notifications from Blip.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Scope Selection -->
			<div class="space-y-2">
				<Label>Integration Scope</Label>
				<RadioGroup.Root bind:value={scope} disabled={isSubmitting}>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="organization" id="scope-org" />
						<Label for="scope-org" class="font-normal">
							Organization - All events across all folders and channels
						</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="folder" id="scope-folder" />
						<Label for="scope-folder" class="font-normal">
							Folder - All events in this folder
						</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="channel" id="scope-channel" />
						<Label for="scope-channel" class="font-normal">
							Channel - Only events in this channel
						</Label>
					</div>
				</RadioGroup.Root>
			</div>

			<!-- Folder Selection -->
			{#if scope === 'folder' || scope === 'channel'}
				<div class="space-y-2">
					<Label for="folder-select">Select Folder *</Label>
					{#await foldersQuery}
						<p class="text-sm text-muted-foreground">Loading folders...</p>
					{:then foldersData}
						{#if foldersData}
							{@const selectedFolder = foldersData.items.find((f) => f.id === selectedFolderId)}
							<Select.Root type="single" bind:value={selectedFolderId} disabled={isSubmitting}>
								<Select.Trigger id="folder-select">
									{selectedFolder?.name ?? 'Choose a folder'}
								</Select.Trigger>
								<Select.Content>
									{#each foldersData.items as folder (folder.id)}
										<Select.Item value={folder.id}>{folder.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/if}
					{:catch error}
						<p class="text-sm text-destructive">Error loading folders</p>
					{/await}
				</div>
			{/if}

			<!-- Channel Selection -->
			{#if scope === 'channel' && selectedFolderId}
				<div class="space-y-2">
					<Label for="channel-select">Select Channel *</Label>
					{#await channelsQuery}
						<p class="text-sm text-muted-foreground">Loading channels...</p>
					{:then channelsData}
						{#if channelsData}
							{@const selectedChannel = channelsData.items.find((c) => c.id === selectedChannelId)}
							<Select.Root type="single" bind:value={selectedChannelId} disabled={isSubmitting}>
								<Select.Trigger id="channel-select">
									{selectedChannel ? `${selectedChannel.icon || ''} ${selectedChannel.name}` : 'Choose a channel'}
								</Select.Trigger>
								<Select.Content>
									{#each channelsData.items as channel (channel.id)}
										<Select.Item value={channel.id}>
											{channel.icon || ''} {channel.name}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/if}
					{:catch error}
						<p class="text-sm text-destructive">Error loading channels</p>
					{/await}
				</div>
			{/if}

			<!-- Webhook URL -->
			<div class="space-y-2">
				<Label for="webhook-url">Webhook URL *</Label>
				<Input
					id="webhook-url"
					type="url"
					bind:value={webhookUrl}
					placeholder="https://hooks.slack.com/services/..."
					disabled={isSubmitting}
					required
				/>
				<p class="text-sm text-muted-foreground">
					Get your webhook URL from Slack's Incoming Webhooks app
				</p>
			</div>

			<!-- Event Filters -->
			<div class="space-y-2">
				<div class="flex items-center space-x-2">
					<Checkbox id="all-events" bind:checked={allEventTypes} disabled={isSubmitting} />
					<Label for="all-events" class="font-normal">All event types</Label>
				</div>
			</div>

			<!-- Tags Filter -->
			<div class="space-y-2">
				<Label for="tags">Filter by tags (optional)</Label>
				<Input
					id="tags"
					bind:value={tags}
					placeholder="production, critical"
					disabled={isSubmitting}
				/>
				<p class="text-sm text-muted-foreground">Comma-separated list of tags to filter events</p>
			</div>

			<!-- Error Display -->
			{#if error}
				<Alert.Root variant="destructive">
					<AlertCircleIcon class="size-4" />
					<Alert.Title>Error</Alert.Title>
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={handleCancel} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button type="button" onclick={handleSubmit} disabled={!isValid || isSubmitting}>
				{isSubmitting ? 'Connecting...' : 'Connect Slack'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
