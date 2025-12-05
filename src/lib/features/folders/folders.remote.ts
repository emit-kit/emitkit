import { z } from 'zod';
import { command, form, query } from '$app/server';
import { folderCreateSchema, folderUpdateSchema, folderListParamsSchema } from './validators';
import * as folderRepo from './server/repository';
import * as folderService from './server/service';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('folders-remote');

export const listFoldersQuery = query(folderListParamsSchema, async (input) => {
	return await folderRepo.listFoldersByOrg(input.organizationId, {
		page: input.page,
		limit: input.limit
	});
});

export const listDeletedFoldersQuery = query(folderListParamsSchema, async (input) => {
	return await folderRepo.listDeletedFoldersByOrg(input.organizationId, {
		page: input.page,
		limit: input.limit
	});
});

const getFolderSchema = z.object({
	folderId: z.string(),
	organizationId: z.string(),
	userId: z.string()
});

export const getFolderQuery = query(getFolderSchema, async (input) => {
	return await folderService.getFolder(input.folderId, input.organizationId);
});

const createFolderWithUserSchema = folderCreateSchema.extend({
	userId: z.string()
});

export const createFolderCommand = command(createFolderWithUserSchema, async (input) => {
	try {
		return await folderService.createFolderWithApiKey(
			{
				organizationId: input.organizationId,
				name: input.name,
				slug: input.slug,
				url: input.url,
				icon: input.icon,
				description: input.description
			},
			input.userId
		);
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'createFolder',
			organizationId: input.organizationId,
			userId: input.userId
		});
		throw error;
	}
});

const updateFolderSchema = z.object({
	folderId: z.string(),
	organizationId: z.string(),
	data: folderUpdateSchema
});

export const updateFolderCommand = command(updateFolderSchema, async (input) => {
	try {
		return await folderService.updateFolder(input.folderId, input.organizationId, input.data);
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'updateFolder',
			folderId: input.folderId,
			organizationId: input.organizationId
		});
		throw error;
	}
});

const updateFolderFormSchema = z.object({
	folderId: z.string(),
	organizationId: z.string(),
	name: z.string().min(1, 'Folder name is required').max(255, 'Folder name is too long')
});

export const updateFolderForm = form(updateFolderFormSchema, async (input) => {
	try {
		return await folderService.updateFolder(input.folderId, input.organizationId, {
			name: input.name
		});
	} catch (error) {
		logger.error('Form submission failed', error as Error, {
			action: 'updateFolder',
			folderId: input.folderId,
			organizationId: input.organizationId
		});
		throw error;
	}
});

const deleteFolderSchema = z.object({
	folderId: z.string(),
	organizationId: z.string()
});

export const deleteFolderCommand = command(deleteFolderSchema, async (input) => {
	try {
		await folderService.deleteFolder(input.folderId, input.organizationId);
		return { success: true };
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'deleteFolder',
			folderId: input.folderId,
			organizationId: input.organizationId
		});
		throw error;
	}
});

const restoreFolderSchema = z.object({
	folderId: z.string(),
	organizationId: z.string()
});

export const restoreFolderCommand = command(restoreFolderSchema, async (input) => {
	try {
		await folderService.restoreFolder(input.folderId, input.organizationId);
		return { success: true };
	} catch (error) {
		logger.error('Command failed', error as Error, {
			action: 'restoreFolder',
			folderId: input.folderId,
			organizationId: input.organizationId
		});
		throw error;
	}
});
