<script lang="ts">
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import type { Folder } from '$lib/features/folders/types';

	interface Props {
		folder: Folder;
		onRename: (folderId: string, currentName: string) => void;
		onDelete: (folderId: string, folderName: string) => void;
	}

	let { folder, onRename, onDelete }: Props = $props();

	function handleRename(event: MouseEvent) {
		event.stopPropagation();
		onRename(folder.id, folder.name);
	}

	function handleDelete(event: MouseEvent) {
		event.stopPropagation();
		onDelete(folder.id, folder.name);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class="rounded-md p-1 hover:bg-accent"
				aria-label="Folder options"
				onclick={(e) => e.stopPropagation()}
			>
				<EllipsisVerticalIcon class="size-4" />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={handleRename}>Rename folder</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={handleDelete} class="text-destructive focus:text-destructive">
			Archive folder
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
