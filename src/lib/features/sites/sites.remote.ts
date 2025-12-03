import { z } from 'zod';
import { command, query } from '$app/server';
import { siteCreateSchema, siteUpdateSchema, siteListParamsSchema } from './validators';
import * as siteRepo from './server/repository';
import * as siteService from './server/service';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('sites-remote');

export const listSitesQuery = query(siteListParamsSchema, async (input) => {
	return await siteRepo.listSitesByOrg(input.organizationId, {
		page: input.page,
		limit: input.limit
	});
});

const getSiteSchema = z.object({
	siteId: z.string(),
	organizationId: z.string(),
	userId: z.string()
});

export const getSiteQuery = query(getSiteSchema, async (input) => {
	return await siteService.getSite(input.siteId, input.organizationId);
});

const createSiteWithUserSchema = siteCreateSchema.extend({
	userId: z.string()
});

export const createSiteCommand = command(createSiteWithUserSchema, async (input) => {
	try {
		return await siteService.createSiteWithApiKey(
			{
				organizationId: input.organizationId,
				name: input.name,
				slug: input.slug,
				icon: input.icon,
				description: input.description
			},
			input.userId
		);
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'createSite',
			organizationId: input.organizationId,
			userId: input.userId
		});
		throw error;
	}
});

const updateSiteSchema = z.object({
	siteId: z.string(),
	organizationId: z.string(),
	data: siteUpdateSchema
});

export const updateSiteCommand = command(updateSiteSchema, async (input) => {
	try {
		return await siteService.updateSite(input.siteId, input.organizationId, input.data);
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'updateSite',
			siteId: input.siteId,
			organizationId: input.organizationId
		});
		throw error;
	}
});

const deleteSiteSchema = z.object({
	siteId: z.string(),
	organizationId: z.string()
});

export const deleteSiteCommand = command(deleteSiteSchema, async (input) => {
	try {
		await siteService.deleteSite(input.siteId, input.organizationId);
		return { success: true };
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'deleteSite',
			siteId: input.siteId,
			organizationId: input.organizationId
		});
		throw error;
	}
});
