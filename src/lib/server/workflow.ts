import { VERCEL_URL } from '$env/static/private';

/**
 * Trigger a workflow by making an HTTP POST request to the workflow endpoint.
 * Returns the workflowRunId for tracking.
 *
 * @param path - Workflow endpoint path (e.g., '/api/workflows/events')
 * @param payload - Workflow payload
 * @returns Promise resolving to { workflowRunId: string }
 *
 * @example
 * ```typescript
 * const { workflowRunId } = await triggerWorkflow('/api/workflows/events', {
 *   eventId: 'evt_123',
 *   channelId: 'ch_123',
 *   organizationId: 'org_123',
 *   notify: true
 * });
 * ```
 */
export async function triggerWorkflow<T>(
	path: string,
	payload: T
): Promise<{ workflowRunId: string }> {
	const url = `${VERCEL_URL}${path}`;

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to trigger workflow: ${response.status} ${errorText}`);
	}

	return response.json();
}
