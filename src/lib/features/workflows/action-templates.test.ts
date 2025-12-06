import { describe, it, expect } from 'vitest';
import {
	actionTemplates,
	triggerTemplates,
	getTemplateById,
	getTemplatesByCategory,
	getTemplatesByType,
	searchTemplates,
	validateTemplateConfig,
	isTemplateReady,
	getAllTemplates,
	categoryMetadata
} from './action-templates';

describe('Action Templates', () => {
	it('should have all action templates defined', () => {
		expect(actionTemplates.length).toBeGreaterThan(0);
		actionTemplates.forEach((template) => {
			expect(template.id).toBeTruthy();
			expect(template.name).toBeTruthy();
			expect(template.description).toBeTruthy();
			expect(template.config).toBeTruthy();
			expect(template.category).toBeTruthy();
			expect(template.type).toBe('action');
		});
	});

	it('should have all trigger templates defined', () => {
		expect(triggerTemplates.length).toBeGreaterThan(0);
		triggerTemplates.forEach((template) => {
			expect(template.id).toBeTruthy();
			expect(template.name).toBeTruthy();
			expect(template.description).toBeTruthy();
			expect(template.config).toBeTruthy();
			expect(template.category).toBeTruthy();
			expect(template.type).toBe('trigger');
		});
	});

	it('should get template by id', () => {
		const template = getTemplateById('slack-message');
		expect(template).toBeTruthy();
		expect(template?.name).toBe('Send to Slack');

		const trigger = getTemplateById('folder-event');
		expect(trigger).toBeTruthy();
		expect(trigger?.name).toBe('Folder Event');

		const notFound = getTemplateById('non-existent');
		expect(notFound).toBeUndefined();
	});

	it('should get templates by category', () => {
		const commTemplates = getTemplatesByCategory('communication');
		expect(commTemplates.length).toBeGreaterThan(0);
		commTemplates.forEach((t) => {
			expect(t.category).toBe('communication');
		});

		const integrationTemplates = getTemplatesByCategory('integration');
		expect(integrationTemplates.length).toBeGreaterThan(0);
		integrationTemplates.forEach((t) => {
			expect(t.category).toBe('integration');
		});
	});

	it('should get templates by type', () => {
		const actions = getTemplatesByType('action');
		expect(actions.length).toBe(actionTemplates.length);
		actions.forEach((t) => {
			expect(t.type).toBe('action');
		});

		const triggers = getTemplatesByType('trigger');
		expect(triggers.length).toBe(triggerTemplates.length);
		triggers.forEach((t) => {
			expect(t.type).toBe('trigger');
		});
	});

	it('should search templates by query', () => {
		const slackResults = searchTemplates('slack');
		expect(slackResults.length).toBeGreaterThan(0);
		expect(slackResults.some((t) => t.id === 'slack-message')).toBe(true);

		const httpResults = searchTemplates('http');
		expect(httpResults.length).toBeGreaterThan(0);

		const folderResults = searchTemplates('folder');
		expect(folderResults.length).toBeGreaterThan(0);
		expect(folderResults.some((t) => t.id === 'folder-event')).toBe(true);
	});

	it('should validate template config', () => {
		const template = getTemplateById('slack-message');
		expect(template).toBeTruthy();

		if (template) {
			// Valid config
			const validConfig = {
				actionType: 'slack',
				webhookUrl: 'https://hooks.slack.com/services/xxx',
				messageTemplate: 'Hello {{event.title}}'
			};
			const validResult = validateTemplateConfig(template, validConfig);
			expect(validResult.valid).toBe(true);
			expect(validResult.missingFields).toHaveLength(0);

			// Invalid config (missing fields)
			const invalidConfig = {
				actionType: 'slack'
			};
			const invalidResult = validateTemplateConfig(template, invalidConfig);
			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.missingFields.length).toBeGreaterThan(0);

			// Check template readiness
			expect(isTemplateReady(template, validConfig)).toBe(true);
			expect(isTemplateReady(template, invalidConfig)).toBe(false);
		}
	});

	it('should get all templates', () => {
		const allTemplates = getAllTemplates();
		expect(allTemplates.length).toBe(actionTemplates.length + triggerTemplates.length);
	});

	it('should have category metadata', () => {
		expect(categoryMetadata.communication).toBeTruthy();
		expect(categoryMetadata.data).toBeTruthy();
		expect(categoryMetadata.logic).toBeTruthy();
		expect(categoryMetadata.integration).toBeTruthy();

		Object.values(categoryMetadata).forEach((meta) => {
			expect(meta.label).toBeTruthy();
			expect(meta.description).toBeTruthy();
			expect(meta.color).toBeTruthy();
		});
	});

	it('should have templates for all existing action types', () => {
		const actionTypes = ['slack', 'discord', 'email', 'http', 'condition'];
		actionTypes.forEach((type) => {
			const template = actionTemplates.find(
				(t) => t.config.actionType === type || t.name.toLowerCase().includes(type)
			);
			expect(template).toBeTruthy();
		});
	});

	it('should have templates for all trigger types', () => {
		const triggerTypes = ['folder', 'channel', 'event_type', 'tag'];
		triggerTypes.forEach((type) => {
			const template = triggerTemplates.find((t) => t.config.triggerType === type);
			expect(template).toBeTruthy();
		});
	});

	it('should have favicon URLs for service-based actions', () => {
		const slackTemplate = getTemplateById('slack-message');
		expect(slackTemplate?.iconUrl).toContain('slack.com');

		const discordTemplate = getTemplateById('discord-message');
		expect(discordTemplate?.iconUrl).toContain('discord.com');

		const githubTemplate = getTemplateById('github-issue');
		expect(githubTemplate?.iconUrl).toContain('github.com');
	});

	it('should have at least 15 action templates total', () => {
		expect(actionTemplates.length).toBeGreaterThanOrEqual(15);
	});

	it('should have all integration templates', () => {
		const integrations = [
			'github-issue',
			'linear-issue',
			'notion-page',
			'airtable-record',
			'trello-card',
			'asana-task',
			'zapier-webhook',
			'make-webhook'
		];

		integrations.forEach((id) => {
			const template = getTemplateById(id);
			expect(template).toBeTruthy();
			expect(template?.category).toBe('integration');
		});
	});
});
