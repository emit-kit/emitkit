<script lang="ts">
	import type { IntegrationWithMetadata } from '../types';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	let {
		integration,
		folderName,
		channelName,
		onTest,
		onViewDetails,
		onDelete,
		isTesting = false
	}: {
		integration: IntegrationWithMetadata;
		folderName?: string;
		channelName?: string;
		onTest: (id: string) => void;
		onViewDetails: (id: string) => void;
		onDelete: (id: string) => void;
		isTesting?: boolean;
	} = $props();

	const Icon = integration.definition.icon;

	const scopeLabels: Record<string, string> = {
		organization: '📊 Organization-wide',
		folder: '📁 Folder',
		channel: '📢 Channel'
	};

	const scopeDescription = $derived.by(() => {
		if (integration.scope === 'organization') {
			return 'All events across all folders and channels';
		}
		if (integration.scope === 'folder') {
			return folderName ? `All events in "${folderName}"` : 'All events in folder';
		}
		if (integration.scope === 'channel') {
			if (channelName && folderName) {
				return `Only events in "${channelName}" (${folderName})`;
			}
			if (channelName) {
				return `Only events in "${channelName}"`;
			}
			return 'Only events in channel';
		}
		return '';
	});

	const eventFilterText = $derived.by(() => {
		const types = integration.eventFilters.eventTypes;
		if (!types || types.length === 0 || types.includes('all')) {
			return 'Receiving all event types';
		}
		if (types.length === 1) {
			return `Receiving: ${types[0]}`;
		}
		return `Receiving ${types.length} event types`;
	});

	const hasTags = $derived.by(() => {
		const tags = integration.eventFilters.tags;
		return tags && tags.length > 0;
	});
</script>

<Card>
	<CardHeader>
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-muted p-2">
					<Icon class="h-6 w-6" />
				</div>
				<div>
					<CardTitle class="text-lg">{integration.definition.name}</CardTitle>
					<CardDescription class="mt-1">{integration.definition.description}</CardDescription>
				</div>
			</div>
			<Badge variant={integration.enabled ? 'default' : 'outline'}>
				{integration.enabled ? 'Connected' : 'Disabled'}
			</Badge>
		</div>
	</CardHeader>
	<CardContent class="space-y-3">
		<div class="flex flex-wrap gap-2">
			<Badge variant="secondary">{scopeLabels[integration.scope]}</Badge>
		</div>
		<div class="space-y-2 text-sm text-muted-foreground">
			<p>{scopeDescription}</p>
			<p>{eventFilterText}</p>
			{#if hasTags}
				<p>
					Tags: {integration.eventFilters.tags?.join(', ')}
				</p>
			{/if}
		</div>
	</CardContent>
	<CardFooter class="flex gap-2">
		<Button
			variant="outline"
			size="sm"
			disabled={isTesting || !integration.enabled}
			onclick={() => onTest(integration.id)}
		>
			<FlaskConicalIcon class="h-4 w-4" />
			{isTesting ? 'Testing...' : 'Test'}
		</Button>
		<Button variant="outline" size="sm" onclick={() => onViewDetails(integration.id)}>
			<SettingsIcon class="h-4 w-4" />
			Details
		</Button>
		<Button variant="destructive" size="sm" onclick={() => onDelete(integration.id)}>
			<TrashIcon class="h-4 w-4" />
			Delete
		</Button>
	</CardFooter>
</Card>
