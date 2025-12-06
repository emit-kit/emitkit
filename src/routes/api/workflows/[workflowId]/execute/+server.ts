import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorkflow } from '$lib/features/workflows/server/repository';
import { createContextLogger } from '$lib/server/logger';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const logger = createContextLogger('workflow-execute');

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const operation = logger.start('Execute workflow', { workflowId: params.workflowId });

	try {
		const session = await locals.getSession({ headers: request.headers });
		const organizationId = session?.session?.activeOrganizationId;

		if (!organizationId) {
			operation.error('Unauthorized - no organization ID');
			error(401, 'Unauthorized');
		}

		// Check if workflow exists first (without org filter)
		const workflowExists = await db.query.workflow.findFirst({
			where: eq(schema.workflow.id, params.workflowId),
			columns: { organizationId: true }
		});

		if (!workflowExists) {
			operation.error('Workflow not found', undefined, { workflowId: params.workflowId });
			error(404, 'Workflow not found');
		}

		// Check ownership to prevent information disclosure
		if (workflowExists.organizationId !== organizationId) {
			operation.error('Forbidden - workflow belongs to different organization', undefined, {
				workflowId: params.workflowId
			});
			error(403, 'Forbidden');
		}

		// Now fetch full workflow (we know it exists and user has access)
		const workflow = await getWorkflow(params.workflowId, organizationId);
		if (!workflow) {
			operation.error('Workflow not found after authorization check', undefined, {
				workflowId: params.workflowId
			});
			error(404, 'Workflow not found');
		}

		if (!workflow.enabled) {
			operation.error('Workflow is disabled', undefined, { workflowId: params.workflowId });
			error(400, 'Workflow is disabled');
		}

		operation.step('Parsing request body');
		const body = await request.json().catch(() => ({}));
		const triggerInput = body.input || {};

		operation.step('Validating workflow structure');
		const nodes = workflow.nodes;
		const edges = workflow.edges;

		// Basic validation
		if (!Array.isArray(nodes) || nodes.length === 0) {
			operation.error('Invalid workflow - no nodes');
			error(400, 'Workflow has no nodes');
		}

		// For now, return a simple success response
		// The actual execution engine integration can be added later
		// when we need to run the workflow logic
		operation.step('Workflow validated successfully');

		const result = {
			success: true,
			workflowId: workflow.id,
			workflowName: workflow.name,
			nodeCount: nodes.length,
			edgeCount: edges.length,
			triggerInput,
			message: 'Workflow execution endpoint ready'
		};

		operation.end({ success: true });

		return json(result);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		operation.error('Workflow execution failed', err as Error);
		logger.error('Unexpected error in workflow execution', err as Error, {
			workflowId: params.workflowId
		});
		error(500, 'Internal server error');
	}
};
