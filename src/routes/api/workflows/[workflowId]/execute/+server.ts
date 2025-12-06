import { serve } from '@upstash/workflow/svelte';
import { env } from '$env/dynamic/private';
import { getWorkflow } from '$lib/features/workflows/server/repository';
import {
	createWorkflowExecution,
	updateWorkflowExecution
} from '$lib/features/workflows/server/repository';
import {
	executeSlackActionNode,
	executeDiscordActionNode,
	executeEmailActionNode,
	executeHttpActionNode,
	executeConditionNode,
	evaluateCondition
} from '$lib/features/workflows/server/execution-engine';
import { createContextLogger } from '$lib/server/logger';
import type { WorkflowNodeData, WorkflowEdgeData } from '$lib/server/db/schema/workflow';

const logger = createContextLogger('workflow-execute');

type TriggerInput = {
	organizationId: string;
	input: {
		eventId: string;
		channelId: string;
		folderId: string;
		eventTitle: string;
		eventDescription?: string;
		eventTags?: string[];
		eventMetadata?: Record<string, unknown>;
	};
};

type ExecutionContext = {
	trigger: TriggerInput['input'];
	outputs: Record<string, unknown>; // nodeId -> output
};

type NodeExecutionLog = {
	nodeId: string;
	nodeName: string;
	status: 'pending' | 'running' | 'success' | 'error';
	output?: unknown;
	error?: string;
	startedAt: string;
	completedAt?: string;
};

export const { POST } = serve<TriggerInput>(
	async (context) => {
		const { organizationId, input } = context.requestPayload;

		// Extract workflowId from URL
		// URL format: https://domain.com/api/workflows/[workflowId]/execute
		const url = new URL(context.url);
		const pathParts = url.pathname.split('/');
		const workflowIdIndex = pathParts.indexOf('workflows') + 1;
		const workflowId = pathParts[workflowIdIndex];

		if (!workflowId) {
			throw new Error('Workflow ID not found in URL');
		}

		const operation = logger.start('Execute workflow', { workflowId, organizationId });

		// Fetch and validate workflow
		const workflow = await context.run('fetch-workflow', async () => {
			operation.step('Fetching workflow');

			if (!organizationId) {
				throw new Error('Organization ID is required');
			}

			const wf = await getWorkflow(workflowId, organizationId);

			if (!wf) {
				throw new Error('Workflow not found or access denied');
			}

			if (!wf.enabled) {
				throw new Error('Workflow is disabled');
			}

			operation.step('Workflow validated', {
				workflowName: wf.name,
				nodeCount: wf.nodes.length
			});

			return wf;
		});

		// Create execution record
		const execution = await context.run('create-execution', async () => {
			operation.step('Creating execution record');

			const exec = await createWorkflowExecution({
				workflowId: workflow.id,
				status: 'running',
				triggeredBy: {
					eventId: input.eventId,
					channelId: input.channelId,
					folderId: input.folderId,
					eventTitle: input.eventTitle
				},
				logs: []
			});

			return exec;
		});

		// Build execution context
		const execContext: ExecutionContext = {
			trigger: input,
			outputs: {}
		};

		const logs: NodeExecutionLog[] = [];

		try {
			// Build workflow graph
			operation.step('Building workflow graph');

			const nodes = workflow.nodes as unknown as WorkflowNodeData[];
			const edges = workflow.edges as unknown as WorkflowEdgeData[];

			// Find trigger nodes (starting points)
			const triggerNodes = nodes.filter((n) => n.type === 'trigger');

			if (triggerNodes.length === 0) {
				throw new Error('No trigger nodes found in workflow');
			}

			// Execute workflow graph starting from trigger nodes
			// Each node is executed as a top-level step via context.run()
			for (const triggerNode of triggerNodes) {
				await executeNodeRecursive(
					triggerNode,
					nodes,
					edges,
					execContext,
					logs,
					context,
					operation
				);
			}

			// Update execution as success
			await context.run('finalize-execution', async () => {
				operation.step('Finalizing execution');

				await updateWorkflowExecution(execution.id, {
					status: 'success',
					logs,
					completedAt: new Date()
				});

				operation.end({ executionId: execution.id, nodesExecuted: logs.length });

				return { success: true };
			});

			return {
				success: true,
				executionId: execution.id,
				workflowId: workflow.id,
				nodesExecuted: logs.length
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Update execution as failed
			await context.run('handle-execution-error', async () => {
				await updateWorkflowExecution(execution.id, {
					status: 'error',
					error: errorMessage,
					logs,
					completedAt: new Date()
				});

				operation.error('Workflow execution failed', error as Error);

				return { error: errorMessage };
			});

			throw error;
		}
	},
	{
		env
	}
);

/**
 * Execute a single node and its downstream nodes recursively
 */
async function executeNodeRecursive(
	node: WorkflowNodeData,
	allNodes: WorkflowNodeData[],
	allEdges: WorkflowEdgeData[],
	context: ExecutionContext,
	logs: NodeExecutionLog[],
	workflowContext: any,
	operation: any
): Promise<void> {
	const startedAt = new Date().toISOString();

	const log: NodeExecutionLog = {
		nodeId: node.id,
		nodeName: node.data.label,
		status: 'running',
		startedAt
	};

	logs.push(log);

	try {
		// Execute this node as a workflow step
		const output = await workflowContext.run(`node-${node.id}`, async () => {
			operation.step(`Executing node: ${node.data.label}`, { nodeId: node.id });

			let result: unknown = null;

			if (node.type === 'trigger') {
				// Trigger nodes don't execute, they just pass through
				result = context.trigger;
			} else if (node.type === 'action') {
				// Execute action node
				result = await executeActionNode(node, context);
			}

			return result;
		});

		// Store output in context
		context.outputs[node.id] = output;

		// Update log
		log.status = 'success';
		log.output = output;
		log.completedAt = new Date().toISOString();

		// Find downstream nodes connected to this node
		const outgoingEdges = allEdges.filter((e) => e.source === node.id);

		// Execute downstream nodes
		for (const edge of outgoingEdges) {
			const targetNode = allNodes.find((n) => n.id === edge.target);
			if (targetNode) {
				// Check if edge has a condition
				if (edge.condition) {
					const conditionMet = evaluateCondition(edge.condition, context);
					if (!conditionMet) {
						continue; // Skip this branch
					}
				}
				await executeNodeRecursive(
					targetNode,
					allNodes,
					allEdges,
					context,
					logs,
					workflowContext,
					operation
				);
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		log.status = 'error';
		log.error = errorMessage;
		log.completedAt = new Date().toISOString();
		throw error; // Re-throw to fail the workflow
	}
}

/**
 * Execute an action node based on its type
 */
async function executeActionNode(
	node: WorkflowNodeData,
	context: ExecutionContext
): Promise<unknown> {
	const config = node.data.config;
	const actionType = 'actionType' in config ? config.actionType : null;

	if (!actionType) {
		throw new Error(`No action type specified for node ${node.id}`);
	}

	switch (actionType) {
		case 'slack':
			return await executeSlackActionNode(node, context);

		case 'discord':
			return await executeDiscordActionNode(node, context);

		case 'email':
			return await executeEmailActionNode(node, context);

		case 'http':
			return await executeHttpActionNode(node, context);

		case 'condition':
			return await executeConditionNode(node, context);

		default:
			throw new Error(`Unknown action type: ${actionType}`);
	}
}
