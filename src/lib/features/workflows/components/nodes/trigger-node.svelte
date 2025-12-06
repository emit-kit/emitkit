<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { WorkflowNode } from '$lib/features/workflows/types';
	import PlayIcon from '@lucide/svelte/icons/play';

	interface Props extends NodeProps {
		data: WorkflowNode['data'];
	}

	let { data, selected }: Props = $props();

	// Get trigger config
	const triggerConfig = $derived(
		data?.config && 'triggerType' in data.config ? data.config : { triggerType: 'unknown' }
	);

	// Status color mapping
	const statusColors = {
		idle: 'bg-card border-border',
		running: 'bg-blue-100/20 border-blue-400 dark:bg-blue-900/20',
		success: 'bg-green-100/20 border-green-400 dark:bg-green-900/20',
		error: 'bg-red-100/20 border-red-400 dark:bg-red-900/20'
	};

	const statusColor = $derived(statusColors[data?.status ?? 'idle']);
</script>

<div
	class="min-w-[200px] rounded-lg border-2 p-4 shadow-md transition-all {statusColor}"
	class:ring-2={selected}
	class:ring-blue-500={selected}
>
	<!-- Header -->
	<div class="mb-2 flex items-center gap-2">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
			<PlayIcon class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
		</div>
		<div class="flex-1">
			<div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trigger</div>
		</div>
	</div>

	<!-- Content -->
	<div class="mb-2">
		<div class="font-semibold text-foreground">{data?.label ?? 'Trigger'}</div>
		{#if data?.description}
			<div class="mt-1 text-xs text-muted-foreground">{data.description}</div>
		{/if}
	</div>

	<!-- Trigger Type Badge -->
	<div class="mt-2">
		<span class="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
			{triggerConfig.triggerType}
		</span>
	</div>

	<!-- Output Handle (only source) -->
	<Handle
		type="source"
		position={Position.Right}
		class="!h-3 !w-3 !border-2 !border-indigo-600 !bg-indigo-100"
	/>
</div>

<style>
	:global(.svelte-flow__handle) {
		background: hsl(var(--card));
	}
</style>
