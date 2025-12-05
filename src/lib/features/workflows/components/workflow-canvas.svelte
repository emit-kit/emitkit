<script lang="ts">
	import { SvelteFlow, Controls, Background, MiniMap, useSvelteFlow } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Node, Edge, Connection, NodeTypes } from '@xyflow/svelte';
	import { workflowStore } from '$lib/features/workflows/stores/workflow-store.svelte';
	import type { WorkflowNode, WorkflowEdge } from '$lib/features/workflows/types';
	import TriggerNode from './nodes/trigger-node.svelte';
	import ActionNode from './nodes/action-node.svelte';
	import { untrack } from 'svelte';

	interface Props {
		workflowId: string;
		initialNodes?: WorkflowNode[];
		initialEdges?: WorkflowEdge[];
		readonly?: boolean;
		class?: string;
		onNodeClick?: (node: Node<WorkflowNode['data'], WorkflowNode['type']>) => void;
		onNodeDoubleClick?: (node: Node<WorkflowNode['data'], WorkflowNode['type']>) => void;
		onCanvasClick?: () => void;
	}

	let {
		workflowId,
		initialNodes = [],
		initialEdges = [],
		readonly = false,
		class: className = '',
		onNodeClick,
		onNodeDoubleClick,
		onCanvasClick
	}: Props = $props();

	// Initialize workflow store once on mount
	$effect(() => {
		workflowStore.initialize(workflowId, initialNodes, initialEdges);

		// Cleanup on unmount
		return () => {
			workflowStore.reset();
		};
	});

	// Local state for XYFlow - use $state.raw as per Svelte Flow docs
	// These are bound to SvelteFlow with bind:nodes and bind:edges
	let nodes = $state.raw<Node<WorkflowNode['data'], WorkflowNode['type']>[]>([]);
	let edges = $state.raw<Edge<WorkflowEdge>[]>([]);

	// Sync FROM store TO canvas (when store changes externally, like addNode)
	$effect(() => {
		// Read from store (create dependency)
		const storeNodes = workflowStore.nodes;
		const storeEdges = workflowStore.edges;

		// Write to local state without triggering the other effect
		untrack(() => {
			nodes = storeNodes;
			edges = storeEdges;
		});
	});

	// Sync FROM canvas TO store (when user drags/deletes nodes via canvas)
	$effect(() => {
		// Read from local state (create dependency on user interactions)
		const currentNodes = nodes;
		const currentEdges = edges;

		// Write to store without triggering the other effect
		untrack(() => {
			if (currentNodes.length > 0 || currentEdges.length > 0) {
				workflowStore.setNodes(currentNodes);
				workflowStore.setEdges(currentEdges);
			}
		});
	});

	// Define custom node types
	const nodeTypes: NodeTypes = {
		trigger: TriggerNode,
		action: ActionNode
	};

	// Handle new connection - onbeforeconnect allows us to validate before connecting
	function handleConnect(connection: Connection) {
		if (readonly) {
			return false;
		}

		// Validate connection (trigger can only be source, not target)
		const sourceNode = nodes.find((n) => n.id === connection.source);
		const targetNode = nodes.find((n) => n.id === connection.target);

		if (!sourceNode || !targetNode) {
			return false;
		}

		// Prevent connecting to a trigger node
		if (targetNode.type === 'trigger') {
			console.warn('Cannot connect to a trigger node');
			return false;
		}

		// Add edge through store (which will sync back to canvas via $derived)
		workflowStore.addEdge(connection);
		return connection;
	}

	// Handle node click
	function handleNodeClickInternal(event: { node: Node; event: MouseEvent | TouchEvent }) {
		const node = event.node as Node<WorkflowNode['data'], WorkflowNode['type']>;
		workflowStore.selectNode(node.id);
		onNodeClick?.(node);
	}

	// Handle node double click
	function handleNodeDoubleClickInternal(event: { node: Node; event: MouseEvent | TouchEvent }) {
		const node = event.node as Node<WorkflowNode['data'], WorkflowNode['type']>;
		onNodeDoubleClick?.(node);
	}

	// Handle canvas click (deselect)
	function handleCanvasClickInternal() {
		workflowStore.selectNode(null);
		onCanvasClick?.();
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		if (readonly) return;

		// Delete selected nodes/edges
		if (event.key === 'Delete' || event.key === 'Backspace') {
			const selectedNodes = nodes.filter((n) => n.selected);
			const selectedEdges = edges.filter((e) => e.selected);

			selectedNodes.forEach((node) => workflowStore.deleteNode(node.id));
			selectedEdges.forEach((edge) => workflowStore.deleteEdge(edge.id));
		}

		// Save workflow
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			workflowStore.forceSave();
		}
	}

	// Get the screenToFlowPosition helper from useSvelteFlow
	const { screenToFlowPosition } = useSvelteFlow();

	// Drag and drop handlers
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();

		if (!event.dataTransfer || readonly) return;

		try {
			// Get the node template data from drag event
			const nodeData = JSON.parse(event.dataTransfer.getData('application/json'));

			// Convert screen coordinates to flow position
			const position = screenToFlowPosition({
				x: event.clientX,
				y: event.clientY
			});

			// Add the node to the workflow
			workflowStore.addNode(nodeData.type, position, {
				label: nodeData.label,
				description: nodeData.description,
				config: nodeData.config
			});
		} catch (error) {
			console.error('Failed to drop node:', error);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="h-full w-full {className}">
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		fitView
		fitViewOptions={{ padding: 0.2 }}
		deleteKey={null}
		class="bg-gray-50"
		ondragover={handleDragOver}
		ondrop={handleDrop}
		onnodeclick={handleNodeClickInternal}
		onpaneclick={handleCanvasClickInternal}
		onbeforeconnect={handleConnect}
	>
		<Background />
		<Controls />
		<MiniMap
			nodeColor={(node) => {
				if (node.type === 'trigger') return '#6366f1';
				if (node.type === 'action') return '#8b5cf6';
				return '#9ca3af';
			}}
			nodeStrokeWidth={3}
		/>
	</SvelteFlow>

	{#if !readonly && workflowStore.isDirty}
		<div class="absolute bottom-4 right-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 shadow-md">
			Saving changes...
		</div>
	{/if}
</div>

<style>
	:global(.svelte-flow) {
		height: 100%;
		width: 100%;
	}

	:global(.svelte-flow__node) {
		cursor: pointer;
	}

	:global(.svelte-flow__edge) {
		cursor: pointer;
	}

	:global(.svelte-flow__edge-path) {
		stroke: #9ca3af;
		stroke-width: 2;
	}

	:global(.svelte-flow__edge.selected .svelte-flow__edge-path) {
		stroke: #3b82f6;
		stroke-width: 3;
	}
</style>
