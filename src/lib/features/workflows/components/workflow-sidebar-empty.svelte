<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MousePointerClickIcon from '@lucide/svelte/icons/mouse-pointer-click';

	interface Props {
		onAddNode: () => void;
	}

	let { onAddNode }: Props = $props();
</script>

<div class="flex h-full flex-col items-center justify-center p-8 text-center">
	<div
		class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 text-muted-foreground"
	>
		<MousePointerClickIcon class="h-10 w-10" />
	</div>

	<h3 class="mb-2 text-lg font-semibold">No node selected</h3>
	<p class="mb-6 text-sm text-muted-foreground">
		Click on a node in the canvas to configure it, or add a new node to get started.
	</p>

	<Button onclick={onAddNode} size="lg" class="gap-2">
		<PlusIcon class="h-4 w-4" />
		Add Node
	</Button>

	<div class="mt-8 space-y-2 text-xs text-muted-foreground">
		<p>Tip: You can also right-click on the canvas to add nodes</p>
		<p>or drag from a node's handle to create connected nodes</p>
	</div>
</div>
