import type { WorkflowNode, WorkflowEdge } from '$lib/features/workflows/types';
import type { Node, Edge, Connection } from '@xyflow/svelte';
import { updateWorkflowCommand } from '$lib/features/workflows/workflows.remote';
import { toast } from 'svelte-sonner';

type WorkflowState = {
	nodes: Node<WorkflowNode['data'], WorkflowNode['type']>[];
	edges: Edge<WorkflowEdge>[];
	selectedNodeId: string | null;
	isDirty: boolean;
	workflowId: string | null;
};

class WorkflowStore {
	private state = $state.raw<WorkflowState>({
		nodes: [],
		edges: [],
		selectedNodeId: null,
		isDirty: false,
		workflowId: null
	});

	private saveTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly AUTOSAVE_DELAY = 2000;

	// Getters using $derived for reactivity
	get nodes() {
		return this.state.nodes;
	}

	get edges() {
		return this.state.edges;
	}

	get selectedNodeId() {
		return this.state.selectedNodeId;
	}

	get isDirty() {
		return this.state.isDirty;
	}

	get workflowId() {
		return this.state.workflowId;
	}

	get selectedNode() {
		return this.state.nodes.find((n) => n.id === this.state.selectedNodeId);
	}

	// Initialize workflow data
	initialize(workflowId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) {
		// Convert WorkflowNode to XYFlow Node format
		const xyflowNodes: Node<WorkflowNode['data'], WorkflowNode['type']>[] = nodes.map((node) => ({
			id: node.id,
			type: node.type,
			position: node.position,
			data: node.data,
			selected: node.selected
		}));

		// Convert WorkflowEdge to XYFlow Edge format
		const xyflowEdges: Edge<WorkflowEdge>[] = edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			type: edge.type,
			selected: edge.selected
		}));

		this.state.nodes = xyflowNodes;
		this.state.edges = xyflowEdges;
		this.state.workflowId = workflowId;
		this.state.isDirty = false;
		this.state.selectedNodeId = null;
	}

	// Set nodes (called by XYFlow onNodesChange)
	setNodes(nodes: Node<WorkflowNode['data'], WorkflowNode['type']>[]) {
		this.state.nodes = nodes;
		this.markDirty();
	}

	// Set edges (called by XYFlow onEdgesChange)
	setEdges(edges: Edge<WorkflowEdge>[]) {
		this.state.edges = edges;
		this.markDirty();
	}

	// Add a new node
	addNode(
		type: WorkflowNode['type'],
		position: { x: number; y: number },
		data: WorkflowNode['data']
	) {
		const newNode: Node<WorkflowNode['data'], WorkflowNode['type']> = {
			id: `node-${Date.now()}`,
			type,
			position,
			data
		};

		this.state.nodes = [...this.state.nodes, newNode];
		this.markDirty();
		return newNode;
	}

	// Update node data
	updateNode(nodeId: string, data: Partial<WorkflowNode['data']>) {
		this.state.nodes = this.state.nodes.map((node) =>
			node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
		);
		this.markDirty();
	}

	// Delete node
	deleteNode(nodeId: string) {
		this.state.nodes = this.state.nodes.filter((node) => node.id !== nodeId);
		// Also remove connected edges
		this.state.edges = this.state.edges.filter(
			(edge) => edge.source !== nodeId && edge.target !== nodeId
		);
		if (this.state.selectedNodeId === nodeId) {
			this.state.selectedNodeId = null;
		}
		this.markDirty();
	}

	// Add edge (called when connecting nodes)
	addEdge(connection: Connection) {
		const newEdge: Edge<WorkflowEdge> = {
			id: `edge-${connection.source}-${connection.target}`,
			source: connection.source,
			target: connection.target,
			type: 'default'
		};

		this.state.edges = [...this.state.edges, newEdge];
		this.markDirty();
		return newEdge;
	}

	// Delete edge
	deleteEdge(edgeId: string) {
		this.state.edges = this.state.edges.filter((edge) => edge.id !== edgeId);
		this.markDirty();
	}

	// Select node
	selectNode(nodeId: string | null) {
		this.state.selectedNodeId = nodeId;
	}

	// Mark as dirty and trigger autosave
	private markDirty() {
		this.state.isDirty = true;
		this.scheduleAutosave();
	}

	// Schedule autosave with debounce
	private scheduleAutosave() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		this.saveTimeout = setTimeout(() => {
			this.save();
		}, this.AUTOSAVE_DELAY);
	}

	// Save workflow to server
	async save() {
		if (!this.state.isDirty || !this.state.workflowId) {
			return;
		}

		try {
			// Convert back to WorkflowNode/WorkflowEdge format for storage
			const nodes: WorkflowNode[] = this.state.nodes.map((node) => ({
				id: node.id,
				type: node.type as WorkflowNode['type'],
				position: node.position,
				data: node.data,
				selected: node.selected
			}));

			const edges: WorkflowEdge[] = this.state.edges.map((edge) => ({
				id: edge.id,
				source: edge.source,
				target: edge.target,
				type: edge.type as WorkflowEdge['type'],
				condition: edge.data?.condition,
				selected: edge.selected
			}));

			// Use SvelteKit remote function instead of direct fetch
			await updateWorkflowCommand({
				workflowId: this.state.workflowId,
				nodes: nodes as any,
				edges: edges as any
			});

			this.state.isDirty = false;
			toast.success('Workflow saved');
		} catch (error) {
			console.error('Failed to save workflow:', error);
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to save workflow';
			toast.error(errorMessage);
		}
	}

	// Force save (for explicit save button)
	async forceSave() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}
		await this.save();
	}

	// Reset store
	reset() {
		this.state.nodes = [];
		this.state.edges = [];
		this.state.selectedNodeId = null;
		this.state.isDirty = false;
		this.state.workflowId = null;
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}
	}
}

// Export singleton instance
export const workflowStore = new WorkflowStore();
