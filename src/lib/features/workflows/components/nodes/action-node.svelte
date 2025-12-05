<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { WorkflowNode } from '$lib/features/workflows/types';
	import ZapIcon from '@lucide/svelte/icons/zap';

	interface Props extends NodeProps {
		data: WorkflowNode['data'];
	}

	let { data, selected }: Props = $props();

	// Get action config
	const actionConfig = $derived(
		data?.config && 'actionType' in data.config ? data.config : { actionType: 'unknown' }
	);

	// Status color mapping
	const statusColors = {
		idle: 'bg-gray-100 border-gray-300',
		running: 'bg-blue-50 border-blue-400',
		success: 'bg-green-50 border-green-400',
		error: 'bg-red-50 border-red-400'
	};

	const statusColor = $derived(statusColors[data?.status ?? 'idle']);

	// Action type icon/color mapping
	const actionStyles = {
		slack: { bg: 'bg-purple-100', text: 'text-purple-600' },
		discord: { bg: 'bg-blue-100', text: 'text-blue-600' },
		email: { bg: 'bg-orange-100', text: 'text-orange-600' },
		http: { bg: 'bg-green-100', text: 'text-green-600' },
		condition: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
		unknown: { bg: 'bg-gray-100', text: 'text-gray-600' }
	};

	const actionStyle = $derived(
		actionStyles[actionConfig.actionType as keyof typeof actionStyles] ?? actionStyles.unknown
	);
</script>

<div
	class="min-w-[200px] rounded-lg border-2 bg-white p-4 shadow-md transition-all {statusColor}"
	class:ring-2={selected}
	class:ring-blue-500={selected}
>
	<!-- Header -->
	<div class="mb-2 flex items-center gap-2">
		<div class="flex h-8 w-8 items-center justify-center rounded-full {actionStyle.bg}">
			<ZapIcon class="h-4 w-4 {actionStyle.text}" />
		</div>
		<div class="flex-1">
			<div class="text-xs font-medium uppercase tracking-wide text-gray-500">Action</div>
		</div>
	</div>

	<!-- Content -->
	<div class="mb-2">
		<div class="font-semibold text-gray-900">{data?.label ?? 'Action'}</div>
		{#if data?.description}
			<div class="mt-1 text-xs text-gray-600">{data.description}</div>
		{/if}
	</div>

	<!-- Action Type Badge -->
	<div class="mt-2">
		<span
			class="inline-flex items-center rounded-full px-2 py-1 text-xs {actionStyle.bg} {actionStyle.text}"
		>
			{actionConfig.actionType}
		</span>
	</div>

	<!-- Input Handle (only target) -->
	<Handle
		type="target"
		position={Position.Left}
		class="!h-3 !w-3 !border-2 !border-gray-600 !bg-gray-100"
	/>

	<!-- Output Handle (also source for chaining actions) -->
	<Handle
		type="source"
		position={Position.Right}
		class="!h-3 !w-3 !border-2 !border-gray-600 !bg-gray-100"
	/>
</div>

<style>
	:global(.svelte-flow__handle) {
		background: white;
	}
</style>
