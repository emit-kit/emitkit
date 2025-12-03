<script lang="ts">
	import MessageSquareIcon from '@lucide/svelte/icons/bell';
	import type { EventListItem } from '$lib/features/events/types.js';
	import AppsIcon from '@lucide/svelte/icons/grid-3x3';
	import BookIcon from '@lucide/svelte/icons/book';
	import CirclePlusIcon from '@lucide/svelte/icons/circle-plus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import GlobeIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { cn } from '$lib/utils/ui.js';
	import { motion } from '$lib/utils/motion.js';
	import EventListItemMetadata from './event-list-item-metadata.svelte';

	let { event, isNew = false }: { event: EventListItem; isNew?: boolean } = $props();

	let isFooterExpanded = $state(false);
	let isDescriptionExpanded = $state(false);
	const hasMetadata = $derived(event.metadata && Object.keys(event.metadata).length > 0);
	const descriptionTruncateLength = 60;
	let scopeMenuOpen = $state(false);
</script>

<div
	class={cn(
		'flex flex-col overflow-hidden rounded-md border text-sm transition-all duration-700 ease-out outline-none',
		isNew ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-border bg-transparent'
	)}
>
	<!-- Header with icon, content, and actions -->
	<div class="flex items-center gap-4 p-4">
		<!-- Icon -->
		<div
			class="flex size-8 shrink-0 items-center justify-center rounded-sm border bg-muted [&_svg]:size-4"
		>
			<MessageSquareIcon />
		</div>

		<!-- Content -->
		<div class="flex flex-1 flex-col gap-0">
			<div class="flex items-center gap-2">
				<span class="text-sm leading-snug font-medium">
					{event.title} - ID: {event.id.slice(6, 12)}
				</span>
				{#if isNew}
					<Badge
						variant="default"
						class="h-5 px-1.5 text-[10px] font-semibold tracking-wider uppercase transition-all duration-500"
					>
						New
					</Badge>
				{/if}
			</div>
			{#if event.description}
				{#if event.description.length > descriptionTruncateLength && !isDescriptionExpanded}
					<p class="text-xs text-muted-foreground">
						{event.description.slice(0, descriptionTruncateLength)}...
						<button
							onclick={() => (isDescriptionExpanded = true)}
							class="ml-1 font-medium hover:underline"
							type="button"
						>
							more
						</button>
					</p>
				{:else}
					<p class="text-xs whitespace-pre-wrap text-muted-foreground">
						{event.description}
						{#if event.description.length > descriptionTruncateLength}
							<button
								onclick={() => (isDescriptionExpanded = false)}
								class="ml-1 font-medium text-primary hover:underline"
								type="button"
							>
								less
							</button>
						{/if}
					</p>
				{/if}
			{/if}
		</div>

		<!-- Actions -->
		<div class="-mr-3 flex items-center gap-2">
			<DropdownMenu.Root bind:open={scopeMenuOpen}>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} size="sm" variant="ghost" class="-mt-4.5 hover:bg-transparent">
							<GlobeIcon />
							<span class="sr-only"> Actions </span>
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>

				<DropdownMenu.Content side="top" align="end" class="[--radius:1rem]">
					<DropdownMenu.Group>
						<DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
							{#snippet child({ props })}
								<label for="web-search" {...props}>
									<GlobeIcon /> Web Search
									<Switch id="web-search" class="ml-auto" checked />
								</label>
							{/snippet}
						</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
							{#snippet child({ props })}
								<label for="apps" {...props}>
									<AppsIcon /> Apps and Integrations
									<Switch id="apps" class="ml-auto" checked />
								</label>
							{/snippet}
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<CirclePlusIcon /> All Sources I can access
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<BookIcon /> Help Center
						</DropdownMenu.Item>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Item>
							<PlusIcon /> Connect Apps
						</DropdownMenu.Item>
						<DropdownMenu.Label class="text-xs text-muted-foreground">
							We'll only search in the sources selected here.
						</DropdownMenu.Label>
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<!-- Footer with full-width border - only shown if metadata exists -->
	{#if hasMetadata}
		<div class="border-t">
			<!-- Clickable header to toggle metadata -->
			<button
				class={cn(
					'flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-muted/50',
					isFooterExpanded ? 'bg-muted/50' : 'bg-transparent'
				)}
				onclick={() => (isFooterExpanded = !isFooterExpanded)}
			>
				<span class="text-sm font-medium"> Details </span>
				<ChevronDownIcon
					class={cn('size-3.5 transition-transform duration-200', {
						'rotate-180': isFooterExpanded,
						'rotate-0': !isFooterExpanded
					})}
				/>
			</button>

			<!-- Expandable metadata content -->
			{#if isFooterExpanded}
				<div
					use:motion={{
						keyframes: {
							opacity: [0, 1],
							y: [-8, 0]
						},
						options: {
							duration: 0.3,
							ease: [0.22, 0.61, 0.36, 1]
						}
					}}
					class="bg-muted/30 px-4 py-3"
				>
					<EventListItemMetadata metadata={event.metadata} />
				</div>
			{/if}
		</div>
	{/if}
</div>
