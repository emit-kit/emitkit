import type { PageServerLoad } from './$types';
import { getWorkflow } from '$lib/features/workflows/server/repository';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, request, params }) => {
	const session = await locals.getSession({
		headers: request.headers
	});

	const organizationId = session?.session?.activeOrganizationId;

	if (!organizationId) {
		error(401, 'Unauthorized');
	}

	const workflow = await getWorkflow(params.workflowId, organizationId);

	if (!workflow) {
		error(404, 'Workflow not found');
	}

	return {
		workflow,
		organizationId
	};
};
