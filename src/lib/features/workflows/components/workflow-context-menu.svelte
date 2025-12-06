<script lang="ts">
	import TrashIcon from '@lucide/svelte/icons/trash';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import PlayIcon from '@lucide/svelte/icons/play';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import MaximizeIcon from '@lucide/svelte/icons/maximize';
	import type { Node, Edge } from '@xyflow/svelte';
	import type { WorkflowNode, WorkflowEdge } from '$lib/features/workflows/types';

	interface ContextMenuAction {
		id: string;
		label: string;
		icon?: any;
		shortcut?: string;
		separator?: boolean;
		disabled?: boolean;
	}

	interface Props {
		type: 'node' | 'edge' | 'canvas' | null;
		position: { x: number; y: number } | null;
		node?: Node<WorkflowNode['data'], WorkflowNode['type']> | null;
		edge?: Edge<WorkflowEdge> | null;
		onAction: (action: string, data?: any) => void;
		onClose: () => void;
	}

	let { type, position, node, edge, onAction, onClose }: Props = $props();

	// Node-specific menu items
	const nodeMenuItems = $derived<ContextMenuAction[]>(
		node
			? node.type === 'add'
				? // Simplified menu for add nodes
					[
						{
							id: 'delete',
							label: 'Delete',
							icon: TrashIcon,
							shortcut: '⌫'
						}
					]
				: // Full menu for regular nodes
					[
						{
							id: 'duplicate',
							label: 'Duplicate',
							icon: CopyIcon,
							shortcut: '⌘D'
						},
						{
							id: 'toggle-enabled',
							label: node.data?.enabled === false ? 'Enable' : 'Disable',
							icon: node.data?.enabled === false ? EyeIcon : EyeOffIcon
						},
						{
							id: 'copy-id',
							label: 'Copy Node ID',
							icon: ClipboardIcon
						},
						{
							id: 'separator-1',
							label: '',
							separator: true
						},
						{
							id: 'delete',
							label: 'Delete',
							icon: TrashIcon,
							shortcut: '⌫'
						}
					]
			: []
	);

	// Edge-specific menu items
	const edgeMenuItems = $derived<ContextMenuAction[]>(
		edge
			? [
					{
						id: 'edge-type-default',
						label: 'Default',
						disabled: edge.type === 'default'
					},
					{
						id: 'edge-type-straight',
						label: 'Straight',
						disabled: edge.type === 'straight'
					},
					{
						id: 'edge-type-step',
						label: 'Step',
						disabled: edge.type === 'step'
					},
					{
						id: 'separator-1',
						label: '',
						separator: true
					},
					{
						id: 'delete-edge',
						label: 'Delete',
						icon: TrashIcon,
						shortcut: '⌫'
					}
				]
			: []
	);

	// Canvas-specific menu items
	const canvasMenuItems: ContextMenuAction[] = [
		{
			id: 'add-trigger',
			label: 'Add Trigger Node',
			icon: PlayIcon
		},
		{
			id: 'add-action',
			label: 'Add Action Node',
			icon: ZapIcon
		},
		{
			id: 'separator-1',
			label: '',
			separator: true
		},
		{
			id: 'fit-view',
			label: 'Fit View',
			icon: MaximizeIcon
		},
		{
			id: 'clear-selection',
			label: 'Clear Selection',
			icon: MinusIcon
		}
	];

	// Get menu items based on context type
	const menuItems = $derived<ContextMenuAction[]>(
		type === 'node'
			? nodeMenuItems
			: type === 'edge'
				? edgeMenuItems
				: type === 'canvas'
					? canvasMenuItems
					: []
	);

	function handleAction(actionId: string) {
		onAction(actionId, { node, edge });
		onClose();
	}

	// Handle clicks outside the menu
	function handleOutsideClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-context-menu]')) {
			onClose();
		}
	}

	// Handle escape key
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} onkeydown={handleKeyDown} />

{#if position && type}
	<div
		data-context-menu
		class="fixed z-50 min-w-[12rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
		style="top: {position.y}px; left: {position.x}px;"
	>
		{#each menuItems as item}
			{#if item.separator}
				<div class="my-1 h-px bg-muted" role="separator"></div>
			{:else}
				<button
					type="button"
					class="relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
					onclick={() => handleAction(item.id)}
					disabled={item.disabled}
				>
					{#if item.icon}
						{@const IconComponent = item.icon}
						<IconComponent class="mr-2 h-4 w-4" />
					{/if}
					<span class="flex-1 text-left">{item.label}</span>
					{#if item.shortcut}
						<span class="ml-auto text-xs tracking-widest opacity-60">{item.shortcut}</span>
					{/if}
				</button>
			{/if}
		{/each}
	</div>
{/if}
