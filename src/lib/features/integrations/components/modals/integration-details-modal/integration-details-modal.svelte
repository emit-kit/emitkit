<script lang="ts">
	import type { StackItemProps } from '@svelte-put/async-stack';
	import type { IntegrationWithMetadata } from '$lib/features/integrations/types';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	interface Props {
		integration: IntegrationWithMetadata;
	}

	let { item, integration }: StackItemProps<{ action?: 'refresh' | 'disconnect' }> & Props =
		$props();

	function handleRefresh() {
		item.resolve({ action: 'refresh' });
	}

	function handleDisconnect() {
		item.resolve({ action: 'disconnect' });
	}

	function handleClose() {
		item.resolve({});
	}

	// Format event types for display
	const eventTypesDisplay = $derived(() => {
		const filters = integration.eventFilters;
		if (!filters || !filters.eventTypes || filters.eventTypes.includes('all')) {
			return 'All event types';
		}
		return filters.eventTypes.join(', ');
	});

	// Format tags for display
	const tagsDisplay = $derived(() => {
		const filters = integration.eventFilters;
		if (!filters || !filters.tags || filters.tags.length === 0) {
			return 'No tag filters';
		}
		return filters.tags;
	});
</script>

<Dialog.Root open={true}>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>Integration Details</Dialog.Title>
			<Dialog.Description>View configuration and settings for this integration.</Dialog.Description>
		</Dialog.Header>

		<div class="grid grid-cols-2 gap-4">
			<!-- Status -->
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Status</p>
				<div>
					{#if integration.enabled}
						<Badge variant="default" class="bg-green-600">Active</Badge>
					{:else}
						<Badge variant="secondary">Disabled</Badge>
					{/if}
				</div>
			</div>

			<!-- Type -->
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Type</p>
				<p class="text-sm capitalize">{integration.type}</p>
			</div>

			<!-- Scope -->
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Scope</p>
				<p class="text-sm capitalize">{integration.scope}</p>
			</div>

			<!-- Event Filters -->
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Event Types</p>
				<p class="text-sm">{eventTypesDisplay()}</p>
			</div>

			<!-- Tags (full width) -->
			<div class="col-span-2 space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Tag Filters</p>
				<div class="flex flex-wrap gap-1">
					{#if typeof tagsDisplay() === 'string'}
						<p class="text-sm text-muted-foreground">{tagsDisplay()}</p>
					{:else}
						{#each tagsDisplay() as tag}
							<Badge variant="outline">{tag}</Badge>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Webhook URL (if present) -->
			{#if integration.config.webhookUrl}
				<div class="col-span-2 space-y-1">
					<p class="text-sm font-medium text-muted-foreground">Webhook URL</p>
					<p class="truncate font-mono text-sm text-muted-foreground">
						{integration.config.webhookUrl}
					</p>
				</div>
			{/if}

			<!-- Created At -->
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Created</p>
				<p class="text-sm">
					{new Date(integration.createdAt).toLocaleDateString()}
				</p>
			</div>

			<!-- Updated At -->
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Last Updated</p>
				<p class="text-sm">
					{new Date(integration.updatedAt).toLocaleDateString()}
				</p>
			</div>
		</div>

		<Dialog.Footer class="flex justify-between sm:justify-between">
			<Button type="button" variant="destructive" onclick={handleDisconnect}>
				<Trash2Icon class="mr-2 size-4" />
				Disconnect
			</Button>
			<div class="flex gap-2">
				<Button type="button" variant="outline" onclick={handleClose}>Close</Button>
				<Button type="button" onclick={handleRefresh}>
					<RefreshCwIcon class="mr-2 size-4" />
					Refresh
				</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
