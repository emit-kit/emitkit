<script lang="ts">
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import type { Site } from '$lib/server/db/schema/site';

	interface Props {
		site: Site;
		onRename: (siteId: string, currentName: string) => void;
		onDelete: (siteId: string, siteName: string) => void;
	}

	let { site, onRename, onDelete }: Props = $props();

	function handleRename(event: MouseEvent) {
		event.stopPropagation();
		onRename(site.id, site.name);
	}

	function handleDelete(event: MouseEvent) {
		event.stopPropagation();
		onDelete(site.id, site.name);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class="rounded-md p-1 hover:bg-accent"
				aria-label="Site options"
				onclick={(e) => e.stopPropagation()}
			>
				<EllipsisVerticalIcon class="size-4" />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={handleRename}> Rename site </DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={handleDelete} class="text-destructive focus:text-destructive">
			Archive site
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
