<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { WorkflowNode } from '$lib/features/workflows/types';
	import PlusIcon from '@lucide/svelte/icons/plus';

	interface Props extends NodeProps {
		data: WorkflowNode['data'];
	}

	let { data, selected }: Props = $props();
</script>

<div
	class="group min-w-[200px] cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-6 shadow-sm transition-all hover:border-primary hover:bg-accent/50 hover:shadow-md"
	class:ring-2={selected}
	class:ring-primary={selected}
	class:border-primary={selected}
>
	<!-- Icon and Text -->
	<div class="flex flex-col items-center justify-center gap-3">
		<!-- Plus Icon -->
		<div
			class="flex h-12 w-12 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10"
		>
			<PlusIcon class="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
		</div>

		<!-- Text -->
		<div class="text-center">
			<div class="font-semibold text-foreground transition-colors group-hover:text-primary">
				Add Node
			</div>
			<div class="mt-1 text-xs text-muted-foreground">
				Click to choose an action
			</div>
		</div>
	</div>

	<!-- Handles -->
	<Handle
		type="target"
		position={Position.Left}
		class="!h-3 !w-3 !border-2 !border-muted-foreground/40 !bg-muted"
	/>

	<Handle
		type="source"
		position={Position.Right}
		class="!h-3 !w-3 !border-2 !border-muted-foreground/40 !bg-muted"
	/>
</div>

<style>
	:global(.svelte-flow__handle) {
		background: hsl(var(--card));
	}
</style>
