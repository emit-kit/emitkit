<script lang="ts">
	import {
		SvelteFlow,
		Controls,
		Background,
		MiniMap,
		useSvelteFlow,
		type ColorMode
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Node, Edge, Connection, NodeTypes } from '@xyflow/svelte';
	import { workflowStore } from '$lib/features/workflows/stores/workflow-store.svelte';
	import type { WorkflowNode, WorkflowEdge } from '$lib/features/workflows/types';
	import TriggerNode from './nodes/trigger-node.svelte';
	import ActionNode from './nodes/action-node.svelte';
	import { untrack } from 'svelte';
	import { mode } from 'mode-watcher';

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

	// Initialize workflow store once on mount and load initial data
	// Convert initialNodes/initialEdges to XYFlow format for canvas
	const initialXYFlowNodes: Node<WorkflowNode['data'], WorkflowNode['type']>[] = initialNodes.map(
		(node) => ({
			id: node.id,
			type: node.type,
			position: node.position,
			data: node.data,
			selected: node.selected
		})
	);

	const initialXYFlowEdges: Edge<WorkflowEdge>[] = initialEdges.map((edge) => ({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		type: edge.type,
		selected: edge.selected
	}));

	// Local state for XYFlow - use $state.raw as per Svelte Flow docs
	// Initialize with data immediately (no $effect needed)
	let nodes = $state.raw<Node<WorkflowNode['data'], WorkflowNode['type']>[]>(initialXYFlowNodes);
	let edges = $state.raw<Edge<WorkflowEdge>[]>(initialXYFlowEdges);

	$inspect('[CANVAS] Initialized with:', {
		workflowId,
		nodes: nodes.length,
		edges: edges.length
	});

	// Initialize store with the same data
	$effect(() => {
		workflowStore.initialize(workflowId, initialNodes, initialEdges);

		// Cleanup on unmount
		return () => {
			workflowStore.reset();
		};
	});

	// Get current color mode for dark mode support
	// mode.current is already reactive, no need for $derived
	const colorMode = mode.current as ColorMode;

	// Define custom node types
	const nodeTypes: NodeTypes = {
		trigger: TriggerNode,
		action: ActionNode
	};

	// Validate connection before it's created
	function handleBeforeConnect(connection: Connection) {
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

		// Return connection to allow it
		return connection;
	}

	// Handle successful connection - this is called AFTER the edge is added to the edges array
	function handleConnect(connection: Connection) {
		console.log('[CONNECT] Connection made:', {
			source: connection.source,
			target: connection.target,
			totalEdges: edges.length
		});

		// The edge has been added to the edges array by Svelte Flow
		// Now explicitly sync to the store to ensure it's saved
		workflowStore.setEdges(edges);
	}

	// Handle node drag stop - sync position changes to store
	function handleNodeDragStop() {
		console.log('[NODE DRAG STOP] Syncing node positions to store');
		workflowStore.setNodes(nodes);
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

			// Manually sync canvas after deletion
			if (selectedNodes.length > 0 || selectedEdges.length > 0) {
				console.log('[DELETE] Manually syncing canvas after deletion');
				nodes = [...workflowStore.nodes];
				edges = [...workflowStore.edges];
			}
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

			console.log('[DROP] Adding node:', {
				type: nodeData.type,
				label: nodeData.label,
				position
			});

			// Add the node to the workflow store
			const newNode = workflowStore.addNode(nodeData.type, position, {
				label: nodeData.label,
				description: nodeData.description,
				config: nodeData.config
			});

			console.log('[DROP] Node added to store:', {
				id: newNode.id,
				storeNodesCount: workflowStore.nodes.length
			});

			// Manually sync canvas with store since we're using $state.raw()
			console.log('[DROP] Manually syncing canvas with store');
			nodes = [...workflowStore.nodes];
			edges = [...workflowStore.edges];

			console.log('[DROP] Canvas updated:', {
				canvasNodesCount: nodes.length,
				canvasEdgesCount: edges.length
			});
		} catch (error) {
			console.error('[DROP] Failed to drop node:', error);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="h-full w-full {className}">
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{colorMode}
		fitView
		fitViewOptions={{ padding: 0.2 }}
		deleteKey={null}
		ondragover={handleDragOver}
		ondrop={handleDrop}
		onnodeclick={handleNodeClickInternal}
		onnodedragstop={handleNodeDragStop}
		onpaneclick={handleCanvasClickInternal}
		onbeforeconnect={handleBeforeConnect}
		onconnect={handleConnect}
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
		<div
			class="absolute right-4 bottom-4 rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-700 shadow-md dark:bg-blue-900/50 dark:text-blue-300"
		>
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
