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
import type { WorkflowInsert } from './types';
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
