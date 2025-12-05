import { command, query, getRequestEvent } from '$app/server';
import { z } from 'zod';
import {
	listIntegrations,
	createIntegration,
	updateIntegration,
	deleteIntegration,
	getIntegration
} from './server/repository';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('integrations-remote');

const listIntegrationsSchema = z.object({
	scope: z.enum(['organization', 'folder', 'channel']).optional(),
	folderId: z.string().optional(),
	channelId: z.string().optional()
});

export const listIntegrationsQuery = query(listIntegrationsSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		const error = new Error('Unauthorized');
		logger.error('Query failed', error, { action: 'listIntegrations' });
		throw error;
	}

	try {
		const integrations = await listIntegrations(activeOrganization.id, input);
		return { integrations };
	} catch (error) {
		logger.error('Query failed', error as Error, {
			action: 'listIntegrations',
			organizationId: activeOrganization.id
		});
		throw error;
	}
});

const createIntegrationSchema = z
	.object({
		scope: z.enum(['organization', 'folder', 'channel']),
		folderId: z.string().optional(),
		channelId: z.string().optional(),
		type: z.enum(['slack', 'discord', 'email']),
		config: z.record(z.string(), z.unknown()),
		eventFilters: z
			.object({
				eventTypes: z.array(z.string()).default(['all']),
				tags: z.array(z.string()).optional()
			})
			.optional()
	})
	.refine(
		(data) => {
			if (data.scope === 'organization') {
				return !data.folderId && !data.channelId;
			}
			if (data.scope === 'folder') {
				return data.folderId && !data.channelId;
			}
			if (data.scope === 'channel') {
				return data.folderId && data.channelId;
			}
			return false;
		},
		{ message: 'Invalid scope configuration' }
	);

export const createIntegrationCommand = command(createIntegrationSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		const error = new Error('Unauthorized');
		logger.error('Command failed', error, { action: 'createIntegration' });
		throw error;
	}

	try {
		const integration = await createIntegration({
			...input,
			organizationId: activeOrganization.id,
			enabled: true,
			eventFilters: input.eventFilters ?? { eventTypes: ['all'] }
		});

		return {
			success: true,
			integration: {
				id: integration.id,
				scope: integration.scope,
				type: integration.type,
				enabled: integration.enabled,
				config: integration.config,
				eventFilters: integration.eventFilters
			}
		};
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'createIntegration',
			type: input.type,
			scope: input.scope
		});
		throw error;
	}
});

const updateIntegrationSchema = z.object({
	integrationId: z.string(),
	enabled: z.boolean().optional(),
	config: z.record(z.string(), z.unknown()).optional(),
	eventFilters: z
		.object({
			eventTypes: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional()
		})
		.optional()
});

export const updateIntegrationCommand = command(updateIntegrationSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user } = locals;

	if (!user) {
		const error = new Error('Unauthorized');
		logger.error('Command failed', error, { action: 'updateIntegration' });
		throw error;
	}

	try {
		const { integrationId, ...updates } = input;

		const integration = await updateIntegration(integrationId, updates);

		return {
			success: true,
			integration: {
				id: integration.id,
				type: integration.type,
				enabled: integration.enabled,
				config: integration.config,
				eventFilters: integration.eventFilters
			}
		};
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'updateIntegration',
			integrationId: input.integrationId
		});
		throw error;
	}
});

const deleteIntegrationSchema = z.object({
	integrationId: z.string()
});

export const deleteIntegrationCommand = command(deleteIntegrationSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user } = locals;

	if (!user) {
		const error = new Error('Unauthorized');
		logger.error('Command failed', error, { action: 'deleteIntegration' });
		throw error;
	}

	try {
		const deleted = await deleteIntegration(input.integrationId);

		if (!deleted) {
			const error = new Error('Integration not found');
			logger.error('Command failed', error, {
				action: 'deleteIntegration',
				integrationId: input.integrationId
			});
			throw error;
		}

		return {
			success: true,
			message: 'Integration deleted successfully'
		};
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'deleteIntegration',
			integrationId: input.integrationId
		});
		throw error;
	}
});

const getIntegrationSchema = z.object({
	integrationId: z.string()
});

export const getIntegrationQuery = query(getIntegrationSchema, async (input) => {
	const { locals } = getRequestEvent();
	const { user, activeOrganization } = locals;

	if (!user || !activeOrganization) {
		const error = new Error('Unauthorized');
		logger.error('Query failed', error, { action: 'getIntegration' });
		throw error;
	}

	try {
		const integration = await getIntegration(input.integrationId, activeOrganization.id);

		if (!integration) {
			throw new Error('Integration not found');
		}

		return { integration };
	} catch (error) {
		logger.error('Query failed', error as Error, {
			action: 'getIntegration',
			integrationId: input.integrationId
		});
		throw error;
	}
});
