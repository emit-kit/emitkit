<script lang="ts">
	import ConfigField from './config-field.svelte';
	import ActionGrid from './action-grid.svelte';
	import ActionTypeSelect from './action-type-select.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { ActionConfig } from '$lib/features/workflows/types';
	import { actionTemplates, type ActionTemplate } from '$lib/features/workflows/action-templates';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	interface Props {
		config: ActionConfig;
		onUpdate: (config: Partial<ActionConfig>, label?: string) => void;
	}

	let { config, onUpdate }: Props = $props();

	function handleActionSelect(template: ActionTemplate) {
		// Update config with template's default config and set label
		onUpdate(template.config, template.name);
	}

	function handleChangeAction() {
		// Reset to show grid again by clearing actionType
		onUpdate({
			actionType: undefined,
			// Clear all other fields
			webhookUrl: undefined,
			messageTemplate: undefined,
			to: undefined,
			subject: undefined,
			body: undefined,
			httpMethod: undefined,
			endpoint: undefined,
			headers: undefined,
			httpBody: undefined,
			condition: undefined
		}, undefined);
	}

	// HTTP header management
	let headerKey = $state('');
	let headerValue = $state('');

	function addHeader() {
		if (!headerKey.trim() || !headerValue.trim()) return;
		const currentHeaders = config.headers || {};
		onUpdate({ headers: { ...currentHeaders, [headerKey.trim()]: headerValue.trim() } });
		headerKey = '';
		headerValue = '';
	}

	function removeHeader(key: string) {
		const currentHeaders = config.headers || {};
		const newHeaders = { ...currentHeaders };
		delete newHeaders[key];
		onUpdate({ headers: newHeaders });
	}

	// HTTP method options
	const httpMethodOptions = [
		{ value: 'GET', label: 'GET' },
		{ value: 'POST', label: 'POST' },
		{ value: 'PUT', label: 'PUT' },
		{ value: 'PATCH', label: 'PATCH' },
		{ value: 'DELETE', label: 'DELETE' }
	];

	// Map action types to labels
	const actionTypeLabels: Record<NonNullable<ActionConfig['actionType']>, string> = {
		slack: 'Send to Slack',
		discord: 'Send to Discord',
		email: 'Send Email',
		http: 'HTTP Request',
		condition: 'Condition'
	};
</script>

{#if !config.actionType}
	<!-- Show action grid when no action type selected -->
	<ActionGrid onSelect={handleActionSelect} />
{:else}
	<div class="space-y-4">
		<!-- Add "Change Action" button at top -->
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onclick={handleChangeAction}
			class="w-full justify-start"
		>
			<ArrowLeftIcon class="mr-2 h-4 w-4" />
			Change Action Type
		</Button>

		<!-- Action Type Selector -->
		<div class="space-y-2">
			<Label class="text-sm font-medium">
				Action Type
				<span class="text-destructive">*</span>
			</Label>
			<p class="text-xs text-muted-foreground">What action should this node perform?</p>
			<ActionTypeSelect
				value={config.actionType || ''}
				onSelect={(templateId) => {
					const template = actionTemplates.find((t) => t.id === templateId);
					if (!template) return;

					// Update with the template's default config and set label
					onUpdate(template.config, template.name);
				}}
			/>
		</div>

	<!-- Slack-specific config -->
	{#if config.actionType === 'slack'}
		<ConfigField
			label="Slack Webhook URL"
			type="url"
			value={config.webhookUrl}
			onchange={(value) => onUpdate({ webhookUrl: String(value) })}
			placeholder="https://hooks.slack.com/services/..."
			description="Your Slack incoming webhook URL"
			required
		/>
		<ConfigField
			label="Message Template"
			type="textarea"
			value={config.messageTemplate}
			onchange={(value) => onUpdate({ messageTemplate: String(value) })}
			placeholder="New event: {`{{event.title}}`}"
			description="Use {`{{event.title}}`}, {`{{event.description}}`}, etc. for dynamic values"
		/>
	{/if}

	<!-- Discord-specific config -->
	{#if config.actionType === 'discord'}
		<ConfigField
			label="Discord Webhook URL"
			type="url"
			value={config.webhookUrl}
			onchange={(value) => onUpdate({ webhookUrl: String(value) })}
			placeholder="https://discord.com/api/webhooks/..."
			description="Your Discord incoming webhook URL"
			required
		/>
		<ConfigField
			label="Message Template"
			type="textarea"
			value={config.messageTemplate}
			onchange={(value) => onUpdate({ messageTemplate: String(value) })}
			placeholder="New event: {`{{event.title}}`}"
			description="Use {`{{event.title}}`}, {`{{event.description}}`}, etc. for dynamic values"
		/>
	{/if}

	<!-- Email-specific config -->
	{#if config.actionType === 'email'}
		<ConfigField
			label="To (Email Address)"
			type="email"
			value={config.to}
			onchange={(value) => onUpdate({ to: String(value) })}
			placeholder="recipient@example.com"
			description="Recipient email address"
			required
		/>
		<ConfigField
			label="Subject"
			type="text"
			value={config.subject}
			onchange={(value) => onUpdate({ subject: String(value) })}
			placeholder="New event notification"
			description="Email subject line"
			required
		/>
		<ConfigField
			label="Body"
			type="textarea"
			value={config.body}
			onchange={(value) => onUpdate({ body: String(value) })}
			placeholder={`Event: {{event.title}}\n\nDescription: {{event.description}}`}
			description="Email body (supports template variables)"
			required
		/>
	{/if}

	<!-- HTTP-specific config -->
	{#if config.actionType === 'http'}
		<ConfigField
			label="HTTP Method"
			type="select"
			value={config.httpMethod}
			onchange={(value) => onUpdate({ httpMethod: String(value) })}
			options={httpMethodOptions}
			description="HTTP request method"
			required
		/>
		<ConfigField
			label="Endpoint URL"
			type="url"
			value={config.endpoint}
			onchange={(value) => onUpdate({ endpoint: String(value) })}
			placeholder="https://api.example.com/webhook"
			description="The URL to send the request to"
			required
		/>

		<!-- Headers -->
		<div class="space-y-2">
			<Label class="text-sm font-medium">Headers (Optional)</Label>
			<p class="text-xs text-muted-foreground">Add custom HTTP headers</p>

			<!-- Add header form -->
			<div class="flex gap-2">
				<Input bind:value={headerKey} placeholder="Header name (e.g., Authorization)" />
				<Input bind:value={headerValue} placeholder="Header value" />
				<Button type="button" size="sm" variant="outline" onclick={addHeader}>
					<PlusIcon class="h-4 w-4" />
				</Button>
			</div>

			<!-- Headers list -->
			{#if config.headers && Object.keys(config.headers).length > 0}
				<div class="space-y-2">
					{#each Object.entries(config.headers) as [key, value]}
						<div class="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
							<div class="flex-1">
								<span class="font-mono text-xs font-semibold">{key}:</span>
								<span class="font-mono text-xs text-muted-foreground"> {value}</span>
							</div>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onclick={() => removeHeader(key)}
							>
								<TrashIcon class="h-3 w-3" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<ConfigField
			label="Request Body (Optional)"
			type="textarea"
			value={config.httpBody}
			onchange={(value) => onUpdate({ httpBody: String(value) })}
			placeholder={`{"event": "{{event.title}}"}`}
			description="JSON body to send with the request (supports template variables)"
		/>
	{/if}

	<!-- Condition-specific config -->
	{#if config.actionType === 'condition'}
		<ConfigField
			label="Condition Expression"
			type="textarea"
			value={config.condition}
			onchange={(value) => onUpdate({ condition: String(value) })}
			placeholder="event.tags.includes('urgent')"
			description="JavaScript expression that evaluates to true/false"
			required
		/>
		<div class="rounded-lg border bg-muted/30 p-3">
			<p class="text-xs text-muted-foreground">
				<strong>Available variables:</strong>
			</p>
			<ul class="mt-1 space-y-1 text-xs text-muted-foreground">
				<li><code class="rounded bg-muted px-1 py-0.5">event.title</code> - Event title</li>
				<li>
					<code class="rounded bg-muted px-1 py-0.5">event.description</code> - Event description
				</li>
				<li><code class="rounded bg-muted px-1 py-0.5">event.tags</code> - Event tags array</li>
				<li>
					<code class="rounded bg-muted px-1 py-0.5">event.metadata</code> - Event metadata object
				</li>
			</ul>
		</div>
	{/if}
	</div>
{/if}
