<script lang="ts">
	import {
		SvelteFlow,
		Controls,
		Background,
		MiniMap,
		useSvelteFlow,
		type ColorMode,
		type OnConnectStartParams,
		type OnConnectStart,
		type OnConnectEnd
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import type { Node, Edge, Connection, NodeTypes } from '@xyflow/svelte';
	import { workflowStore } from '$lib/features/workflows/stores/workflow-store.svelte';
	import type { WorkflowNode, WorkflowEdge } from '$lib/features/workflows/types';
	import TriggerNode from './nodes/trigger-node.svelte';
	import ActionNode from './nodes/action-node.svelte';
	import AddNode from './nodes/add-node.svelte';
	import WorkflowContextMenu from './workflow-context-menu.svelte';
	import { untrack } from 'svelte';
	import { mode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';

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

	// Initialize store with the same data
	$effect(() => {
		// Reset first to clear previous workflow data
		workflowStore.reset();

		// Now initialize with new workflow
		workflowStore.initialize(workflowId, initialNodes, initialEdges);

		// Sync canvas with store after initialization (e.g., if store added placeholder "add" node)
		nodes = [...workflowStore.nodes];
		edges = [...workflowStore.edges];
	});

	// Get current color mode for dark mode support
	// mode.current is already reactive, no need for $derived
	const colorMode = mode.current as ColorMode;

	// Define custom node types
	const nodeTypes: NodeTypes = {
		trigger: TriggerNode,
		action: ActionNode,
		add: AddNode
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
			toast.warning('Cannot connect to a trigger node');
			return false;
		}

		// Prevent connecting to or from an add node
		if (sourceNode.type === 'add' || targetNode.type === 'add') {
			toast.info('Click the add node to choose an action first');
			return false;
		}

		// Return connection to allow it
		return connection;
	}

	// Handle successful connection - this is called AFTER the edge is added to the edges array
	function handleConnect(connection: Connection) {
		// The edge has been added to the edges array by Svelte Flow
		// Now explicitly sync to the store to ensure it's saved
		workflowStore.setEdges(edges);
	}

	// Handle node drag stop - sync position changes to store
	function handleNodeDragStop() {
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

		// Close context menu on ESC (handled by context menu component)
		// Delete selected nodes/edges
		if (event.key === 'Delete' || event.key === 'Backspace') {
			const selectedNodes = nodes.filter((n) => n.selected);
			const selectedEdges = edges.filter((e) => e.selected);

			selectedNodes.forEach((node) => workflowStore.deleteNode(node.id));
			selectedEdges.forEach((edge) => workflowStore.deleteEdge(edge.id));

			// Manually sync canvas after deletion
			if (selectedNodes.length > 0 || selectedEdges.length > 0) {
				nodes = [...workflowStore.nodes];
				edges = [...workflowStore.edges];
				if (selectedNodes.length > 0) {
					toast.success(`Deleted ${selectedNodes.length} node(s)`);
				}
				if (selectedEdges.length > 0) {
					toast.success(`Deleted ${selectedEdges.length} edge(s)`);
				}
			}
		}

		// Duplicate selected node (Cmd/Ctrl + D)
		if ((event.metaKey || event.ctrlKey) && event.key === 'd') {
			event.preventDefault();
			const selectedNode = nodes.find((n) => n.selected);
			if (selectedNode) {
				const newNode = workflowStore.duplicateNode(selectedNode.id);
				if (newNode) {
					nodes = [...workflowStore.nodes];
					toast.success('Node duplicated');
				}
			}
		}

		// Save workflow
		if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
			workflowStore.forceSave();
		}
	}

	// Get the screenToFlowPosition and fitView helper from useSvelteFlow
	const { screenToFlowPosition, fitView } = useSvelteFlow();

	// Connection state tracking for auto-connection
	let connectingNodeId = $state<string | null>(null);
	let connectingHandleType = $state<'source' | 'target' | null>(null);

	// Context menu state
	let contextMenu = $state<{
		type: 'node' | 'edge' | 'canvas' | null;
		position: { x: number; y: number } | null;
		node?: Node<WorkflowNode['data'], WorkflowNode['type']> | null;
		edge?: Edge<WorkflowEdge> | null;
	}>({
		type: null,
		position: null,
		node: null,
		edge: null
	});

	// Context menu handlers
	function handleNodeContextMenu(event: { event: MouseEvent; node: Node }) {
		if (readonly) return;
		event.event.preventDefault();
		contextMenu = {
			type: 'node',
			position: { x: event.event.clientX, y: event.event.clientY },
			node: event.node as Node<WorkflowNode['data'], WorkflowNode['type']>,
			edge: null
		};
	}

	function handleEdgeContextMenu(event: { event: MouseEvent; edge: Edge }) {
		if (readonly) return;
		event.event.preventDefault();
		contextMenu = {
			type: 'edge',
			position: { x: event.event.clientX, y: event.event.clientY },
			node: null,
			edge: event.edge as Edge<WorkflowEdge>
		};
	}

	function handlePaneContextMenu({ event }: { event: MouseEvent }) {
		if (readonly) return;
		event.preventDefault();

		// Get flow position for adding nodes
		const position = screenToFlowPosition({
			x: event.clientX,
			y: event.clientY
		});

		contextMenu = {
			type: 'canvas',
			position: { x: event.clientX, y: event.clientY },
			node: null,
			edge: null
		};

		// Store the flow position for later use when adding nodes
		(contextMenu as any).flowPosition = position;
	}

	function closeContextMenu() {
		contextMenu = {
			type: null,
			position: null,
			node: null,
			edge: null
		};
	}

	// Context menu action handlers
	async function handleContextMenuAction(action: string, data?: any) {
		switch (action) {
			case 'duplicate':
				if (data?.node) {
					const newNode = workflowStore.duplicateNode(data.node.id);
					if (newNode) {
						nodes = [...workflowStore.nodes];
						toast.success('Node duplicated');
					}
				}
				break;

			case 'toggle-enabled':
				if (data?.node) {
					workflowStore.toggleNodeEnabled(data.node.id);
					nodes = [...workflowStore.nodes];
					const isEnabled = nodes.find(n => n.id === data.node.id)?.data?.enabled !== false;
					toast.success(isEnabled ? 'Node enabled' : 'Node disabled');
				}
				break;

			case 'copy-id':
				if (data?.node) {
					await navigator.clipboard.writeText(data.node.id);
					toast.success('Node ID copied to clipboard');
				}
				break;

			case 'delete':
				if (data?.node) {
					workflowStore.deleteNode(data.node.id);
					nodes = [...workflowStore.nodes];
					edges = [...workflowStore.edges];
					toast.success('Node deleted');
				}
				break;

			case 'edge-type-default':
			case 'edge-type-straight':
			case 'edge-type-step':
				if (data?.edge) {
					const edgeType = action.replace('edge-type-', '') as 'default' | 'straight' | 'step';
					workflowStore.updateEdgeType(data.edge.id, edgeType);
					edges = [...workflowStore.edges];
					toast.success(`Edge type changed to ${edgeType}`);
				}
				break;

			case 'delete-edge':
				if (data?.edge) {
					workflowStore.deleteEdge(data.edge.id);
					edges = [...workflowStore.edges];
					toast.success('Edge deleted');
				}
				break;

			case 'add-trigger':
				{
					const flowPosition = (contextMenu as any).flowPosition;
					if (flowPosition) {
						const newNode = workflowStore.addNode('trigger', flowPosition, {
							label: 'New Trigger',
							description: '',
							config: { triggerType: 'channel', channelId: '' }
						});
						nodes = [...workflowStore.nodes];
						workflowStore.selectNode(newNode.id);
						toast.success('Trigger node added');
					}
				}
				break;

			case 'add-action':
				{
					const flowPosition = (contextMenu as any).flowPosition;
					if (flowPosition) {
						const newNode = workflowStore.addNode('action', flowPosition, {
							label: 'New Action',
							description: '',
							config: { actionType: 'slack', webhookUrl: '', messageTemplate: '' }
						});
						nodes = [...workflowStore.nodes];
						workflowStore.selectNode(newNode.id);
						toast.success('Action node added');
					}
				}
				break;

			case 'fit-view':
				fitView({ padding: 0.2, duration: 300 });
				toast.success('View fitted');
				break;

			case 'clear-selection':
				workflowStore.clearSelection();
				nodes = [...workflowStore.nodes];
				edges = [...workflowStore.edges];
				toast.success('Selection cleared');
				break;
		}
	}

	// Handle connection drag start
	const handleConnectStart: OnConnectStart = (event, params) => {
		if (readonly) return;

		connectingNodeId = params.nodeId;
		connectingHandleType = params.handleType;
	};

	// Handle connection drag end - auto-create node if dropped on empty canvas
	const handleConnectEnd: OnConnectEnd = (event) => {
		if (!connectingNodeId || !connectingHandleType) {
			connectingNodeId = null;
			connectingHandleType = null;
			return;
		}

		try {
			// Check if dropped on empty canvas (not on another node)
			const target = event.target as Element;
			const targetIsPane = target.classList.contains('svelte-flow__pane');

			if (targetIsPane) {
				// Get cursor position in flow coordinates
				const clientX = 'clientX' in event ? event.clientX : event.touches?.[0]?.clientX;
				const clientY = 'clientY' in event ? event.clientY : event.touches?.[0]?.clientY;

				if (clientX === undefined || clientY === undefined) {
					return;
				}

				const position = screenToFlowPosition({
					x: clientX,
					y: clientY
				});

				// Validate position is within reasonable bounds
				if (
					position.x < -10000 ||
					position.y < -10000 ||
					position.x > 10000 ||
					position.y > 10000
				) {
					return;
				}

				// Always create an action node (workflows always flow from trigger -> actions)
				const nodeType = 'action' as const;

				// Get default config for action node
				const defaultConfig = {
					actionType: 'slack' as const,
					webhookUrl: '',
					messageTemplate: ''
				};

				// Create new node at cursor position
				const newNode = workflowStore.addNode(nodeType, position, {
					label: 'New Action',
					description: '',
					config: defaultConfig
				});

				// Auto-connect based on which handle was dragged
				if (connectingHandleType === 'source') {
					// User dragged FROM a node TO empty space
					workflowStore.addEdge({
						source: connectingNodeId,
						target: newNode.id,
						sourceHandle: null,
						targetHandle: null
					});
				} else {
					// User dragged TO a node FROM empty space (reverse)
					workflowStore.addEdge({
						source: newNode.id,
						target: connectingNodeId,
						sourceHandle: null,
						targetHandle: null
					});
				}

				// Manually sync canvas with store since we're using $state.raw()
				nodes = [...workflowStore.nodes];
				edges = [...workflowStore.edges];

				// Select the new node and open config panel
				workflowStore.selectNode(newNode.id);

				// Show success feedback
				toast.success('Action added and connected');
			}
		} catch (error) {
			toast.error('Failed to add node');
		} finally {
			// Reset connection state
			connectingNodeId = null;
			connectingHandleType = null;
		}
	};

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

			// Add the node to the workflow store
			workflowStore.addNode(nodeData.type, position, {
				label: nodeData.label,
				description: nodeData.description,
				config: nodeData.config
			});

			// Manually sync canvas with store since we're using $state.raw()
			nodes = [...workflowStore.nodes];
			edges = [...workflowStore.edges];
		} catch (error) {
			toast.error('Failed to add node');
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="relative h-full w-full {className} {connectingNodeId ? 'cursor-copy' : ''}">
	{#if connectingNodeId}
		<div class="pointer-events-none absolute inset-0 z-10 bg-primary/5 transition-colors"></div>
	{/if}

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
		onnodecontextmenu={handleNodeContextMenu}
		onedgecontextmenu={handleEdgeContextMenu}
		onpaneclick={handleCanvasClickInternal}
		onpanecontextmenu={handlePaneContextMenu}
		onbeforeconnect={handleBeforeConnect}
		onconnect={handleConnect}
		onconnectstart={handleConnectStart}
		onconnectend={handleConnectEnd}
	>
		<Background />
		<Controls />
		<MiniMap
			nodeColor={(node) => {
				if (node.type === 'trigger') return '#6366f1';
				if (node.type === 'action') return '#8b5cf6';
				if (node.type === 'add') return '#d1d5db';
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

	<!-- Context Menu -->
	<WorkflowContextMenu
		type={contextMenu.type}
		position={contextMenu.position}
		node={contextMenu.node}
		edge={contextMenu.edge}
		onAction={handleContextMenuAction}
		onClose={closeContextMenu}
	/>
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
