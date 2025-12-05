import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import type {
	Workflow,
	WorkflowInsert,
	WorkflowExecution,
	WorkflowExecutionInsert
} from '$lib/server/db/schema';
import type { PaginationParams, PaginatedQueryResult } from '$lib/server/db/utils';
import { buildPaginatedQuery } from '$lib/server/db/utils';
import { createContextLogger } from '$lib/server/logger';

const logger = createContextLogger('workflow-repository');

// Create workflow
export async function createWorkflow(workflow: WorkflowInsert): Promise<Workflow> {
	const [created] = await db.insert(schema.workflow).values(workflow).returning();
	if (!created) throw new Error('Failed to create workflow');

	logger.info('Workflow created', { workflowId: created.id, name: created.name });
	return created;
}

// Get workflow by ID
export async function getWorkflow(
	id: string,
	organizationId: string
): Promise<Workflow | null> {
	const workflow = await db.query.workflow.findFirst({
		where: and(eq(schema.workflow.id, id), eq(schema.workflow.organizationId, organizationId))
	});
	return workflow ?? null;
}

// List workflows for organization
export async function listWorkflows(
	organizationId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<Workflow>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	const query = db.query.workflow.findMany({
		where: eq(schema.workflow.organizationId, organizationId),
		orderBy: [desc(schema.workflow.updatedAt)],
		limit,
		offset
	});

	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.workflow)
		.where(eq(schema.workflow.organizationId, organizationId));

	return await buildPaginatedQuery(query, countQuery, { page, limit });
}

// Update workflow
export async function updateWorkflow(
	id: string,
	organizationId: string,
	data: Partial<WorkflowInsert>
): Promise<Workflow> {
	const [updated] = await db
		.update(schema.workflow)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(schema.workflow.id, id), eq(schema.workflow.organizationId, organizationId)))
		.returning();

	if (!updated) throw new Error('Workflow not found');

	logger.info('Workflow updated', { workflowId: id });
	return updated;
}

// Delete workflow
export async function deleteWorkflow(id: string, organizationId: string): Promise<void> {
	await db
		.delete(schema.workflow)
		.where(and(eq(schema.workflow.id, id), eq(schema.workflow.organizationId, organizationId)));

	logger.info('Workflow deleted', { workflowId: id });
}

// Get enabled workflows for trigger matching
export async function getEnabledWorkflows(organizationId: string): Promise<Workflow[]> {
	return await db.query.workflow.findMany({
		where: and(
			eq(schema.workflow.organizationId, organizationId),
			eq(schema.workflow.enabled, true)
		)
	});
}

// --- Workflow Executions ---

// Create execution
export async function createWorkflowExecution(
	execution: WorkflowExecutionInsert
): Promise<WorkflowExecution> {
	const [created] = await db.insert(schema.workflowExecution).values(execution).returning();
	if (!created) throw new Error('Failed to create workflow execution');

	logger.info('Workflow execution created', {
		executionId: created.id,
		workflowId: created.workflowId
	});
	return created;
}

// Update execution
export async function updateWorkflowExecution(
	id: string,
	data: Partial<WorkflowExecutionInsert>
): Promise<WorkflowExecution> {
	const [updated] = await db
		.update(schema.workflowExecution)
		.set(data)
		.where(eq(schema.workflowExecution.id, id))
		.returning();

	if (!updated) throw new Error('Workflow execution not found');

	return updated;
}

// Get execution by ID
export async function getWorkflowExecution(id: string): Promise<WorkflowExecution | null> {
	const execution = await db.query.workflowExecution.findFirst({
		where: eq(schema.workflowExecution.id, id)
	});
	return execution ?? null;
}

// List executions for workflow
export async function listWorkflowExecutions(
	workflowId: string,
	pagination?: PaginationParams
): Promise<PaginatedQueryResult<WorkflowExecution>> {
	const page = pagination?.page ?? 1;
	const limit = pagination?.limit ?? 20;
	const offset = (page - 1) * limit;

	const query = db.query.workflowExecution.findMany({
		where: eq(schema.workflowExecution.workflowId, workflowId),
		orderBy: [desc(schema.workflowExecution.startedAt)],
		limit,
		offset
	});

	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.workflowExecution)
		.where(eq(schema.workflowExecution.workflowId, workflowId));

	return await buildPaginatedQuery(query, countQuery, { page, limit });
}
