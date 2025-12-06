<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import {
		actionTemplates,
		categoryMetadata,
		type ActionTemplate,
		type ActionCategory
	} from '$lib/features/workflows/action-templates';

	interface Props {
		onSelect: (template: ActionTemplate) => void;
	}

	let { onSelect }: Props = $props();

	let searchQuery = $state('');
	let activeCategory = $state<string>('all');

	const filteredTemplates = $derived.by(() => {
		return actionTemplates.filter((template) => {
			const matchesSearch =
				template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				template.description.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesCategory = activeCategory === 'all' || template.category === activeCategory;

			return matchesSearch && matchesCategory;
		});
	});
</script>

<div class="flex h-full flex-col">
	<!-- Header with Search -->
	<div class="border-b p-4">
		<h3 class="mb-3 text-lg font-semibold">Choose an Action</h3>
		<div class="relative">
			<SearchIcon class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input bind:value={searchQuery} placeholder="Search actions..." class="pl-9" />
		</div>
	</div>

	<!-- Category Tabs -->
	<Tabs.Root bind:value={activeCategory} class="flex flex-1 flex-col overflow-hidden">
		<div class="border-b px-4">
			<Tabs.List class="w-full justify-start">
				<Tabs.Trigger value="all">All</Tabs.Trigger>
				<Tabs.Trigger value="communication">
					{categoryMetadata.communication.label}
				</Tabs.Trigger>
				<Tabs.Trigger value="data">
					{categoryMetadata.data.label}
				</Tabs.Trigger>
				<Tabs.Trigger value="logic">
					{categoryMetadata.logic.label}
				</Tabs.Trigger>
				<Tabs.Trigger value="integration">
					{categoryMetadata.integration.label}
				</Tabs.Trigger>
			</Tabs.List>
		</div>

		<!-- Action Grid -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if filteredTemplates.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<p class="text-sm text-muted-foreground">No actions found</p>
					<p class="mt-1 text-xs text-muted-foreground">Try a different search term</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-3">
					{#each filteredTemplates as template (template.id)}
						<button
							type="button"
							onclick={() => onSelect(template)}
							class="group flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-all hover:border-primary hover:bg-accent hover:shadow-md"
						>
							<!-- Icon -->
							<div
								class="flex h-10 w-10 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-primary/10"
							>
								{#if template.iconUrl}
									<img
										src={template.iconUrl}
										alt={template.name}
										class="h-6 w-6"
										onerror={(e) => {
											// Fallback if favicon fails to load - hide image and show default icon
											const target = e.currentTarget;
											if (target instanceof HTMLImageElement) {
												target.style.display = 'none';
												// Show fallback icon by inserting it after the image
												const fallback = document.createElement('div');
												fallback.className = 'h-6 w-6 rounded bg-primary/20';
												if (target.parentElement) {
													target.parentElement.appendChild(fallback);
												}
											}
										}}
									/>
								{:else}
									<!-- Default icon for actions without favicon -->
									<ZapIcon class="h-5 w-5 text-muted-foreground" />
								{/if}
							</div>

							<!-- Text -->
							<div class="space-y-1">
								<p class="text-sm font-medium leading-none">
									{template.name}
								</p>
								<p class="text-xs text-muted-foreground">
									{template.description}
								</p>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</Tabs.Root>
</div>
