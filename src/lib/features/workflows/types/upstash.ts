export interface UpstashWorkflowRun {
	workflowRunId: string;
	workflowUrl: string;
	workflowState: 'RUN_STARTED' | 'RUN_SUCCESS' | 'RUN_FAILED' | 'RUN_CANCELED';
	workflowRunCreatedAt: number;
	workflowRunCompletedAt?: number;
	workflowRunResponse?: unknown;
	failureFunction?: string | null;
	dlqId?: string | null;
	steps: Array<{
		type: 'sequential' | 'parallel';
		steps: Array<{
			stepId?: number;
			stepName: string;
			stepType: string;
			callType: string;
			messageId: string;
			concurrent: number;
			state: 'STEP_SUCCESS' | 'STEP_FAILED' | 'STEP_PENDING';
			createdAt: number;
			callResponseBody?: string;
			callResponseStatus?: number;
			callResponseHeaders?: unknown[];
		}>;
	}>;
}

export interface UpstashLogsResponse {
	runs: UpstashWorkflowRun[];
	cursor?: string;
}
