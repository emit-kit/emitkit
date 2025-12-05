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
		idle: 'bg-gray-100 border-gray-300',
		running: 'bg-blue-50 border-blue-400',
		success: 'bg-green-50 border-green-400',
		error: 'bg-red-50 border-red-400'
	};

	const statusColor = $derived(statusColors[data?.status ?? 'idle']);
</script>

<div
	class="min-w-[200px] rounded-lg border-2 bg-white p-4 shadow-md transition-all {statusColor}"
	class:ring-2={selected}
	class:ring-blue-500={selected}
>
	<!-- Header -->
	<div class="mb-2 flex items-center gap-2">
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
			<PlayIcon class="h-4 w-4 text-indigo-600" />
		</div>
		<div class="flex-1">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-500">Trigger</div>
		</div>
	</div>

	<!-- Content -->
	<div class="mb-2">
		<div class="font-semibold text-gray-900">{data?.label ?? 'Trigger'}</div>
		{#if data?.description}
			<div class="mt-1 text-xs text-gray-600">{data.description}</div>
		{/if}
	</div>

	<!-- Trigger Type Badge -->
	<div class="mt-2">
		<span class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
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
		background: white;
	}
</style>
