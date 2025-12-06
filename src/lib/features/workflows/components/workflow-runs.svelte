<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Card from '$lib/components/ui/card';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { listWorkflowExecutionsQuery } from '$lib/features/workflows/workflows.remote';
	import type { WorkflowExecution } from '$lib/features/workflows/types';
	import { onDestroy } from 'svelte';

	interface Props {
		workflowId: string;
		nodeId?: string; // Optional: filter by specific node
		limit?: number;
	}

	let { workflowId, nodeId, limit = 10 }: Props = $props();

	let selectedExecutionId = $state<string | null>(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Fetch executions from Upstash using remote function
	let executionsPromise = $state(listWorkflowExecutionsQuery({ workflowId, limit }));

	// Poll for updates if there are running workflows
	$effect(() => {
		executionsPromise.then((data) => {
			const hasRunning = data.items.some((e) => e.status === 'running');

			if (hasRunning && !pollInterval) {
				// Poll every 3 seconds while workflows are running
				pollInterval = setInterval(() => {
					executionsPromise = listWorkflowExecutionsQuery({ workflowId, limit });
				}, 3000);
			} else if (!hasRunning && pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		});
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	function getStatusIcon(status: WorkflowExecution['status']) {
		switch (status) {
			case 'success':
				return CheckCircleIcon;
			case 'error':
				return XCircleIcon;
			case 'running':
				return LoaderCircleIcon;
			case 'pending':
			default:
				return ClockIcon;
		}
	}

	function getStatusColor(status: WorkflowExecution['status']) {
		switch (status) {
			case 'success':
				return 'text-green-500';
			case 'error':
				return 'text-destructive';
			case 'running':
				return 'text-blue-500';
			case 'pending':
			default:
				return 'text-muted-foreground';
		}
	}

	function formatDuration(startedAt: Date, completedAt?: Date | null) {
		const end = completedAt || new Date();
		const duration = end.getTime() - startedAt.getTime();
		const seconds = Math.floor(duration / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		return `${minutes}m ${seconds % 60}s`;
	}
</script>

<div class="space-y-4">
	{#await executionsPromise}
		<div class="flex items-center justify-center py-8">
			<LoaderCircleIcon class="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	{:then data}
		{#if data.items.length === 0}
			<div class="rounded-lg border border-dashed p-8 text-center">
				<p class="text-sm text-muted-foreground">No executions yet</p>
				<p class="mt-1 text-xs text-muted-foreground">
					This workflow hasn't been triggered yet
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.items as execution (execution.id)}
				{@const StatusIcon = getStatusIcon(execution.status)}
				<Card.Root
					class="cursor-pointer transition-colors hover:bg-accent {selectedExecutionId ===
					execution.id
						? 'border-primary'
						: ''}"
					onclick={() => {
						selectedExecutionId =
							selectedExecutionId === execution.id ? null : execution.id;
					}}
				>
					<Card.Header class="p-3">
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-2">
								<StatusIcon class="h-4 w-4 {getStatusColor(execution.status)}" />
								<div>
									<p class="text-sm font-medium">
										{new Date(execution.startedAt).toLocaleString()}
									</p>
									{#if execution.completedAt}
										<p class="text-xs text-muted-foreground">
											Duration: {formatDuration(
												new Date(execution.startedAt),
												new Date(execution.completedAt)
											)}
										</p>
									{/if}
								</div>
							</div>
							<Badge variant={execution.status === 'success' ? 'default' : 'destructive'}>
								{execution.status}
							</Badge>
						</div>

						{#if execution.error}
							<p class="mt-2 text-xs text-destructive">{execution.error}</p>
						{/if}

						<!-- Expand to show logs -->
						{#if selectedExecutionId === execution.id && execution.logs}
							<Separator class="my-2" />
							<div class="space-y-2">
								{#each execution.logs as log}
									<div class="rounded-md bg-muted p-2">
										<div class="flex items-center justify-between">
											<p class="text-xs font-medium">{log.nodeName}</p>
											<Badge variant="outline" class="text-xs">{log.status}</Badge>
										</div>
										{#if log.error}
											<p class="mt-1 text-xs text-destructive">{log.error}</p>
										{/if}
										{#if log.output}
											<pre
												class="mt-1 overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(
													log.output,
													null,
													2
												)}</pre>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</Card.Header>
				</Card.Root>
				{/each}
			</div>
		{/if}
	{:catch error}
		<div class="rounded-lg border border-destructive p-4">
			<p class="text-sm text-destructive">Failed to load executions</p>
			<p class="text-xs text-muted-foreground">{error.message || 'Unknown error'}</p>
		</div>
	{/await}
</div>
