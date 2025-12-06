import { command, query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import {
	listWorkflows,
	getWorkflow,
	createWorkflow,
	updateWorkflow,
	deleteWorkflow
} from './server/repository';
import { createWorkflowSchema, updateWorkflowSchema } from './validators';
import type { WorkflowInsert, WorkflowExecution } from './types';
import { workflowClient, getWorkflowEndpoint } from '$lib/server/upstash-workflow';
import { createContextLogger } from '$lib/server/logger';

const logger = createContextLogger('workflows-remote');

// Query: List workflows
const listWorkflowsSchema = z.object({
	organizationId: z.string(),
	page: z.number().optional(),
	limit: z.number().optional()
});

export const listWorkflowsQuery = query(listWorkflowsSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user } = locals;

	if (!user) {
		throw new Error('Unauthorized');
	}

	try {
		return await listWorkflows(input.organizationId, {
			page: input.page,
			limit: input.limit
		});
	} catch (error) {
		logger.error('Failed to list workflows', error as Error, {
			organizationId: input.organizationId
		});
		throw error;
	}
});

// Query: Get workflow by ID
const getWorkflowSchema = z.object({
	workflowId: z.string(),
	organizationId: z.string()
});

export const getWorkflowQuery = query(getWorkflowSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user } = locals;

	if (!user) {
		throw new Error('Unauthorized');
	}

	try {
		const workflow = await getWorkflow(input.workflowId, input.organizationId);
		if (!workflow) {
			throw new Error('Workflow not found');
		}
		return { workflow };
	} catch (error) {
		logger.error('Failed to get workflow', error as Error, {
			workflowId: input.workflowId
		});
		throw error;
	}
});

// Command: Create workflow
export const createWorkflowCommand = command(createWorkflowSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		throw new Error('Unauthorized');
	}

	try {
		const workflowData: WorkflowInsert = {
			organizationId: activeOrganization.id,
			name: input.name,
			description: input.description,
			nodes: input.nodes || [],
			edges: input.edges || [],
			enabled: input.enabled ?? true
		};

		const workflow = await createWorkflow(workflowData);
		return { success: true, workflow };
	} catch (error) {
		logger.error('Failed to create workflow', error as Error, {
			name: input.name
		});
		throw error;
	}
});

// Command: Update workflow
const updateWorkflowCommandSchema = updateWorkflowSchema.extend({
	workflowId: z.string()
});

export const updateWorkflowCommand = command(updateWorkflowCommandSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		throw new Error('Unauthorized');
	}

	try {
		const { workflowId, ...updateData } = input;
		const workflow = await updateWorkflow(workflowId, activeOrganization.id, updateData);
		return { success: true, workflow };
	} catch (error) {
		logger.error('Failed to update workflow', error as Error, {
			workflowId: input.workflowId
		});
		throw error;
	}
});

// Command: Delete workflow
const deleteWorkflowSchema = z.object({
	workflowId: z.string()
});

export const deleteWorkflowCommand = command(deleteWorkflowSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		throw new Error('Unauthorized');
	}

	try {
		await deleteWorkflow(input.workflowId, activeOrganization.id);
		return { success: true };
	} catch (error) {
		logger.error('Failed to delete workflow', error as Error, {
			workflowId: input.workflowId
		});
		throw error;
	}
});

// Command: Execute workflow via Upstash
const executeWorkflowSchema = z.object({
	workflowId: z.string(),
	triggerInput: z.record(z.string(), z.unknown()).optional()
});

export const executeWorkflowCommand = command(executeWorkflowSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		throw new Error('Unauthorized');
	}

	try {
		const endpoint = getWorkflowEndpoint(input.workflowId);

		const { workflowRunId } = await workflowClient.trigger({
			url: endpoint,
			body: { input: input.triggerInput || {} }
		});

		logger.info('Workflow triggered via Upstash', {
			workflowId: input.workflowId,
			workflowRunId
		});

		return { workflowRunId, status: 'running' as const };
	} catch (error) {
		logger.error('Failed to execute workflow', error as Error, {
			workflowId: input.workflowId
		});
		throw error;
	}
});

// Query: List workflow executions from Upstash
const listWorkflowExecutionsSchema = z.object({
	workflowId: z.string(),
	limit: z.number().optional()
});

export const listWorkflowExecutionsQuery = query(listWorkflowExecutionsSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		throw new Error('Unauthorized');
	}

	try {
		const endpoint = getWorkflowEndpoint(input.workflowId);
		const limit = input.limit ?? 20;

		const { runs, cursor } = await workflowClient.logs({
			workflowUrl: endpoint,
			count: limit
		});

		return {
			items: runs.map((run) => transformUpstashRunToExecution(run)),
			hasMore: !!cursor,
			cursor
		};
	} catch (error) {
		logger.error('Failed to fetch workflow executions', error as Error, {
			workflowId: input.workflowId
		});
		// Return empty result instead of throwing to prevent UI crashes
		return {
			items: [],
			hasMore: false,
			cursor: undefined
		};
	}
});

// Helper: Transform Upstash run data to our execution format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformUpstashRunToExecution(run: any): WorkflowExecution {
	return {
		id: run.workflowRunId,
		workflowId: extractWorkflowIdFromUrl(run.workflowUrl),
		status: mapUpstashStatus(run.workflowState),
		triggeredBy: {
			eventId: 'manual',
			channelId: 'manual',
			folderId: 'manual',
			eventTitle: 'Manual execution'
		},
		startedAt: new Date(run.workflowRunCreatedAt),
		completedAt: run.workflowRunCompletedAt ? new Date(run.workflowRunCompletedAt) : null,
		error: run.workflowState === 'RUN_FAILED' ? 'Workflow execution failed' : null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		logs: (run.steps || []).flatMap((step: any) =>
			step.type === 'sequential'
				? // eslint-disable-next-line @typescript-eslint/no-explicit-any
					step.steps.map((s: any) => ({
						nodeId: s.stepId?.toString() || s.stepName,
						nodeName: s.stepName,
						status: mapStepStatus(s.state),
						error: s.state === 'STEP_FAILED' ? s.callResponseBody || 'Step failed' : undefined,
						output: s.callResponseBody ? tryParseJSON(s.callResponseBody) : undefined,
						startedAt: new Date(s.createdAt).toISOString(),
						completedAt: new Date(s.createdAt).toISOString()
					}))
				: []
		)
	};
}

function mapUpstashStatus(state: string): WorkflowExecution['status'] {
	switch (state) {
		case 'RUN_STARTED':
			return 'running';
		case 'RUN_SUCCESS':
			return 'success';
		case 'RUN_FAILED':
		case 'RUN_CANCELED':
			return 'error';
		default:
			return 'pending';
	}
}

function mapStepStatus(state: string): 'success' | 'error' | 'running' | 'pending' {
	switch (state) {
		case 'STEP_SUCCESS':
			return 'success';
		case 'STEP_FAILED':
			return 'error';
		case 'STEP_PENDING':
			return 'pending';
		default:
			return 'pending';
	}
}

function extractWorkflowIdFromUrl(url: string): string {
	// Extract workflow ID from URL like: https://app.com/api/workflows/wf_123/execute
	const match = url.match(/\/workflows\/([^/]+)\/execute/);
	return match ? match[1] : 'unknown';
}

function tryParseJSON(str: string): unknown {
	try {
		return JSON.parse(str);
	} catch {
		return str;
	}
}
