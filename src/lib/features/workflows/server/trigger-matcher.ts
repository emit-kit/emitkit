import type { Workflow, WorkflowNodeData, TriggerConfig } from '$lib/server/db/schema/workflow';
import { getEnabledWorkflows } from './repository';
import { executeWorkflow } from './execution-engine';
import { createContextLogger } from '$lib/server/logger';

const logger = createContextLogger('trigger-matcher');

type EventData = {
	eventId: string;
	channelId: string;
	folderId: string;
	organizationId: string;
	title: string;
	description?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
};

/**
 * Find and execute workflows that match the given event
 */
export async function matchAndExecuteWorkflows(event: EventData): Promise<void> {
	const operation = logger.start('Match and execute workflows', {
		eventId: event.eventId,
		organizationId: event.organizationId
	});

	try {
		// Get all enabled workflows for this organization
		const workflows = await getEnabledWorkflows(event.organizationId);

		operation.step(`Found ${workflows.length} enabled workflows`);

		// Find workflows with matching triggers
		const matchingWorkflows = workflows.filter((workflow) =>
			workflowMatchesEvent(workflow, event)
		);

		operation.step(`${matchingWorkflows.length} workflows match event`);

		if (matchingWorkflows.length === 0) {
			operation.end({ matchingWorkflows: 0 });
			return;
		}

		// Execute matching workflows (fire-and-forget)
		const executions = matchingWorkflows.map((workflow) =>
			executeWorkflow(workflow, {
				eventId: event.eventId,
				channelId: event.channelId,
				folderId: event.folderId,
				eventTitle: event.title,
				eventDescription: event.description,
				eventTags: event.tags,
				eventMetadata: event.metadata
			}).catch((error) => {
				logger.error('Workflow execution failed', error, {
					workflowId: workflow.id,
					eventId: event.eventId
				});
			})
		);

		// Don't await - fire and forget
		Promise.all(executions).catch((error) => {
			logger.error('One or more workflow executions failed', error);
		});

		operation.end({ matchingWorkflows: matchingWorkflows.length });
	} catch (error) {
		operation.error('Failed to match and execute workflows', error as Error);
	}
}

/**
 * Check if a workflow's triggers match the given event
 */
function workflowMatchesEvent(workflow: Workflow, event: EventData): boolean {
	const nodes = workflow.nodes as unknown as WorkflowNodeData[];

	// Find all trigger nodes
	const triggerNodes = nodes.filter((n) => n.type === 'trigger');

	if (triggerNodes.length === 0) {
		return false;
	}

	// Check if ANY trigger matches (OR logic)
	return triggerNodes.some((node) => triggerMatches(node.data.config as TriggerConfig, event));
}

/**
 * Check if a trigger configuration matches the given event
 */
function triggerMatches(trigger: TriggerConfig, event: EventData): boolean {
	switch (trigger.triggerType) {
		case 'folder':
			return matchFolderTrigger(trigger, event);

		case 'channel':
			return matchChannelTrigger(trigger, event);

		case 'event_type':
			return matchEventTypeTrigger(trigger, event);

		case 'tag':
			return matchTagTrigger(trigger, event);

		default:
			logger.warn('Unknown trigger type', { triggerType: (trigger as any).triggerType });
			return false;
	}
}

/**
 * Match folder trigger: event must be in the specified folder
 */
function matchFolderTrigger(trigger: TriggerConfig, event: EventData): boolean {
	if (trigger.triggerType !== 'folder' || !trigger.folderId) {
		return false;
	}

	// Check folder match
	if (trigger.folderId !== event.folderId) {
		return false;
	}

	// Optional: Check event types filter
	if (trigger.eventTypes && trigger.eventTypes.length > 0) {
		if (!trigger.eventTypes.includes('all')) {
			// TODO: Check specific event types when we add event type field
			// For now, accept all events
		}
	}

	// Optional: Check tags filter
	if (trigger.tags && trigger.tags.length > 0) {
		if (!event.tags || !hasAnyTag(event.tags, trigger.tags)) {
			return false;
		}
	}

	return true;
}

/**
 * Match channel trigger: event must be in the specified channel
 */
function matchChannelTrigger(trigger: TriggerConfig, event: EventData): boolean {
	if (trigger.triggerType !== 'channel' || !trigger.channelId) {
		return false;
	}

	// Check channel match
	if (trigger.channelId !== event.channelId) {
		return false;
	}

	// Optional: Check event types filter
	if (trigger.eventTypes && trigger.eventTypes.length > 0) {
		if (!trigger.eventTypes.includes('all')) {
			// TODO: Check specific event types when we add event type field
		}
	}

	// Optional: Check tags filter
	if (trigger.tags && trigger.tags.length > 0) {
		if (!event.tags || !hasAnyTag(event.tags, trigger.tags)) {
			return false;
		}
	}

	return true;
}

/**
 * Match event type trigger: event type must match
 */
function matchEventTypeTrigger(trigger: TriggerConfig, event: EventData): boolean {
	if (trigger.triggerType !== 'event_type' || !trigger.eventTypes) {
		return false;
	}

	// For now, match all events since we don't have event type field yet
	// TODO: Add event type field to events table and match here
	if (trigger.eventTypes.includes('all')) {
		return true;
	}

	// Optional: Check tags filter
	if (trigger.tags && trigger.tags.length > 0) {
		if (!event.tags || !hasAnyTag(event.tags, trigger.tags)) {
			return false;
		}
	}

	return true;
}

/**
 * Match tag trigger: event must have at least one matching tag
 */
function matchTagTrigger(trigger: TriggerConfig, event: EventData): boolean {
	if (trigger.triggerType !== 'tag' || !trigger.tags || trigger.tags.length === 0) {
		return false;
	}

	if (!event.tags || event.tags.length === 0) {
		return false;
	}

	return hasAnyTag(event.tags, trigger.tags);
}

/**
 * Check if array A has any element from array B
 */
function hasAnyTag(eventTags: string[], triggerTags: string[]): boolean {
	return triggerTags.some((tag) => eventTags.includes(tag));
}
