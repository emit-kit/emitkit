<script lang="ts">
	import type { StackItemProps } from '@svelte-put/async-stack';
	import { deleteIntegrationCommand } from '$lib/features/integrations/integrations.remote';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import { toast } from 'svelte-sonner';

	interface Props {
		integrationName: string;
		integrationId: string;
	}

	let { item, integrationName, integrationId }: StackItemProps<boolean> & Props = $props();

	let isDeleting = $state(false);
	let error = $state<string | null>(null);

	function handleCancel() {
		item.resolve(false);
	}

	async function handleDelete() {
		isDeleting = true;
		error = null;

		try {
			const result = await deleteIntegrationCommand({ integrationId });

			if (result.success) {
				toast.success('Integration disconnected successfully');
				item.resolve(true);
			} else {
				throw new Error('Failed to delete integration');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to disconnect integration';
			isDeleting = false;
		}
	}
</script>

<Dialog.Root open={true}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-destructive">
				<AlertTriangleIcon class="size-5" />
				Disconnect Integration
			</Dialog.Title>
			<Dialog.Description>Are you sure you want to disconnect this integration?</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Warning Alert -->
			<Alert.Root variant="destructive">
				<AlertTriangleIcon class="size-4" />
				<Alert.Title>This action cannot be undone</Alert.Title>
				<Alert.Description>
					This will permanently remove the <strong>{integrationName}</strong> integration. You will stop
					receiving event notifications at this endpoint.
				</Alert.Description>
			</Alert.Root>

			<!-- Error Display -->
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Title>Error</Alert.Title>
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={handleCancel} disabled={isDeleting}>
				Cancel
			</Button>
			<Button type="button" variant="destructive" onclick={handleDelete} disabled={isDeleting}>
				{isDeleting ? 'Disconnecting...' : 'Disconnect Integration'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
