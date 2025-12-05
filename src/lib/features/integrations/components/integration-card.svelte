<script lang="ts">
	import type { IntegrationDefinition } from '../constants';
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

	let {
		integration,
		isConnected = false,
		onConnect
	}: {
		integration: IntegrationDefinition;
		isConnected?: boolean;
		onConnect: (integration: IntegrationDefinition) => void;
	} = $props();

	const Icon = integration.icon;
	const isComingSoon = integration.status === 'coming_soon';
</script>

<Card>
	<CardHeader>
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-muted p-2">
					<Icon class="h-6 w-6" />
				</div>
				<div>
					<CardTitle class="text-lg">{integration.name}</CardTitle>
				</div>
			</div>
			<div class="flex gap-2">
				{#if isComingSoon}
					<Badge variant="secondary">Coming Soon</Badge>
				{:else if isConnected}
					<Badge variant="default">Connected</Badge>
				{/if}
			</div>
		</div>
		<CardDescription class="mt-3">{integration.description}</CardDescription>
	</CardHeader>
	<CardFooter>
		<Button
			variant={isConnected ? 'outline' : 'default'}
			class="w-full"
			disabled={isComingSoon}
			onclick={() => onConnect(integration)}
		>
			{isConnected ? 'Manage' : 'Connect'}
		</Button>
	</CardFooter>
</Card>
