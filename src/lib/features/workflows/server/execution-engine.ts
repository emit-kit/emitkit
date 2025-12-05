import type { Workflow, WorkflowNodeData, WorkflowEdgeData } from '$lib/server/db/schema/workflow';
import { createWorkflowExecution, updateWorkflowExecution } from './repository';
import { createContextLogger } from '$lib/server/logger';

const logger = createContextLogger('workflow-execution');

type ExecutionContext = {
	trigger: {
		eventId: string;
		channelId: string;
		folderId: string;
		eventTitle: string;
		eventDescription?: string;
		eventTags?: string[];
		eventMetadata?: Record<string, unknown>;
	};
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

/**
 * Execute a workflow with the given trigger event
 */
export async function executeWorkflow(
	workflow: Workflow,
	triggerEvent: {
		eventId: string;
		channelId: string;
		folderId: string;
		eventTitle: string;
		eventDescription?: string;
		eventTags?: string[];
		eventMetadata?: Record<string, unknown>;
	}
): Promise<void> {
	const operation = logger.start('Execute workflow', {
		workflowId: workflow.id,
		workflowName: workflow.name,
		eventId: triggerEvent.eventId
	});

	// Create execution record
	const execution = await createWorkflowExecution({
		workflowId: workflow.id,
		status: 'running',
		triggeredBy: {
			eventId: triggerEvent.eventId,
			channelId: triggerEvent.channelId,
			folderId: triggerEvent.folderId,
			eventTitle: triggerEvent.eventTitle
		},
		logs: []
	});

	const context: ExecutionContext = {
		trigger: triggerEvent,
		outputs: {}
	};

	const logs: NodeExecutionLog[] = [];

	try {
		operation.step('Building execution graph');
		const nodes = workflow.nodes as unknown as WorkflowNodeData[];
		const edges = workflow.edges as unknown as WorkflowEdgeData[];

		// Find trigger nodes (starting points)
		const triggerNodes = nodes.filter((n) => n.type === 'trigger');

		if (triggerNodes.length === 0) {
			throw new Error('No trigger nodes found in workflow');
		}

		// Execute workflow graph starting from trigger nodes
		for (const triggerNode of triggerNodes) {
			await executeNode(triggerNode, nodes, edges, context, logs);
		}

		// Update execution as success
		await updateWorkflowExecution(execution.id, {
			status: 'success',
			logs,
			completedAt: new Date()
		});

		operation.end({ executionId: execution.id, nodesExecuted: logs.length });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Workflow execution failed', error as Error, {
			workflowId: workflow.id,
			executionId: execution.id
		});

		// Update execution as failed
		await updateWorkflowExecution(execution.id, {
			status: 'error',
			error: errorMessage,
			logs,
			completedAt: new Date()
		});

		operation.error('Workflow execution failed', error as Error);
	}
}

/**
 * Execute a single node and its downstream nodes
 */
async function executeNode(
	node: WorkflowNodeData,
	allNodes: WorkflowNodeData[],
	allEdges: WorkflowEdgeData[],
	context: ExecutionContext,
	logs: NodeExecutionLog[]
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
		let output: unknown = null;

		if (node.type === 'trigger') {
			// Trigger nodes don't execute, they just pass through
			output = context.trigger;
		} else if (node.type === 'action') {
			// Execute action node
			output = await executeActionNode(node, context);
		}

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
				await executeNode(targetNode, allNodes, allEdges, context, logs);
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

/**
 * Execute Slack action
 */
async function executeSlackActionNode(
	node: WorkflowNodeData,
	context: ExecutionContext
): Promise<{ sent: boolean }> {
	const config = node.data.config;
	if (!('webhookUrl' in config) || !config.webhookUrl) {
		throw new Error('Slack webhook URL not configured');
	}

	const messageTemplate = 'messageTemplate' in config ? config.messageTemplate : '';
	const message = interpolateTemplate(messageTemplate as string, context);

	// Send to Slack webhook
	const webhookUrl = config.webhookUrl as string;
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			text: message,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: message
					}
				}
			]
		}),
		signal: AbortSignal.timeout(10000)
	});

	if (!response.ok) {
		throw new Error(`Slack webhook failed: ${response.status}`);
	}

	return { sent: true };
}

/**
 * Execute Discord action
 */
async function executeDiscordActionNode(
	node: WorkflowNodeData,
	context: ExecutionContext
): Promise<{ sent: boolean }> {
	const config = node.data.config;
	if (!('webhookUrl' in config) || !config.webhookUrl) {
		throw new Error('Discord webhook URL not configured');
	}

	const messageTemplate = 'messageTemplate' in config ? config.messageTemplate : '';
	const message = interpolateTemplate(messageTemplate as string, context);

	// Send to Discord webhook
	const webhookUrl = config.webhookUrl as string;
	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			content: message,
			embeds: [
				{
					description: message,
					color: 0x5865f2
				}
			]
		}),
		signal: AbortSignal.timeout(10000)
	});

	if (!response.ok) {
		throw new Error(`Discord webhook failed: ${response.status}`);
	}

	return { sent: true };
}

/**
 * Execute Email action (placeholder)
 */
async function executeEmailActionNode(
	node: WorkflowNodeData,
	context: ExecutionContext
): Promise<{ sent: boolean }> {
	const config = node.data.config;
	logger.info('Email action executed', { nodeId: node.id, config });
	// TODO: Implement email sending
	return { sent: false };
}

/**
 * Execute HTTP request action
 */
async function executeHttpActionNode(
	node: WorkflowNodeData,
	context: ExecutionContext
): Promise<unknown> {
	const config = node.data.config;
	if (!('endpoint' in config) || !config.endpoint) {
		throw new Error('HTTP endpoint not configured');
	}

	const method = ('httpMethod' in config ? config.httpMethod : 'POST') as string;
	const endpoint = interpolateTemplate(config.endpoint as string, context);
	const headers = ('headers' in config ? config.headers : {}) as Record<string, string>;
	const body = 'httpBody' in config ? config.httpBody : null;

	const response = await fetch(endpoint, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...headers
		},
		...(body && method !== 'GET' && { body: interpolateTemplate(body as string, context) })
	});

	if (!response.ok) {
		throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
	}

	return await response.json();
}

/**
 * Execute condition node
 */
async function executeConditionNode(
	node: WorkflowNodeData,
	context: ExecutionContext
): Promise<{ result: boolean }> {
	const config = node.data.config;
	if (!('condition' in config) || !config.condition) {
		throw new Error('Condition not configured');
	}

	const result = evaluateCondition(config.condition as string, context);
	return { result };
}

/**
 * Interpolate template variables with context data
 * Supports {{trigger.eventTitle}}, {{trigger.eventDescription}}, etc.
 */
function interpolateTemplate(template: string, context: ExecutionContext): string {
	return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
		const keys = path.trim().split('.');
		let value: any = context;

		for (const key of keys) {
			if (value && typeof value === 'object' && key in value) {
				value = value[key];
			} else {
				return match; // Return original if path not found
			}
		}

		return String(value ?? '');
	});
}

/**
 * Evaluate a condition expression
 * Simple evaluation for now - can be extended
 */
function evaluateCondition(condition: string, context: ExecutionContext): boolean {
	try {
		// Interpolate variables in condition
		const interpolated = interpolateTemplate(condition, context);

		// Simple evaluation (very basic)
		// TODO: Use a safer expression evaluator
		// eslint-disable-next-line no-eval
		return eval(interpolated) as boolean;
	} catch (error) {
		logger.warn('Condition evaluation failed', { condition, error });
		return false;
	}
}
