<script lang="ts">
	import type { StackItemProps } from '@svelte-put/async-stack';
	import { deleteFolderCommand } from '$lib/features/folders/folders.remote';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import { Label } from '$lib/components/ui/label';

	// Props interface
	interface Props {
		folderId: string;
		organizationId: string;
		folderName: string;
	}

	// Component props with StackItemProps for modal integration
	let { item, folderId, organizationId, folderName }: StackItemProps<{ success: boolean }> & Props =
		$props();

	let confirmText = $state('');
	let isDeleting = $state(false);
	let error = $state<string | null>(null);

	const isConfirmed = $derived(confirmText === folderName);

	// Handle cancel
	function handleCancel() {
		item.resolve({ success: false });
	}

	// Handle delete
	async function handleDelete() {
		if (!isConfirmed) return;

		isDeleting = true;
		error = null;

		try {
			await deleteFolderCommand({
				folderId,
				organizationId
			});

			item.resolve({ success: true });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete folder';
			isDeleting = false;
		}
	}
</script>

<Dialog.Root open={true}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-destructive">
				<AlertTriangleIcon class="size-5" />
				Archive Folder
			</Dialog.Title>
			<Dialog.Description>
				This will archive the folder and make it inaccessible. The folder can be restored within
				your organization's retention period.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-2">
			<!-- Warning Alert -->
			<Alert.Root variant="destructive">
				<AlertTriangleIcon class="size-4" />
				<Alert.Title>Archiving this folder will hide:</Alert.Title>
				<Alert.Description class="space-y-2">
					<ul class="list-inside list-disc space-y-1 text-sm">
						<li><strong>All channels</strong> associated with this folder</li>
						<li><strong>All webhooks</strong> configured for these channels</li>
						<li><strong>API access</strong> - API keys will be disabled</li>
					</ul>
					<p class="mt-3 text-sm">
						<strong>Note:</strong> Events and identity data are preserved and can be restored if you
						unarchive the folder.
					</p>
				</Alert.Description>
			</Alert.Root>

			<!-- Confirmation Input -->
			<div class="space-y-2">
				<Label for="confirm-text">
					Type <span class="font-mono font-semibold text-destructive">{folderName}</span> to confirm
				</Label>
				<Input
					id="confirm-text"
					bind:value={confirmText}
					placeholder={folderName}
					disabled={isDeleting}
					class="font-mono"
				/>
			</div>

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
			<Button
				type="button"
				variant="destructive"
				onclick={handleDelete}
				disabled={!isConfirmed || isDeleting}
			>
				{isDeleting ? 'Archiving...' : 'Archive Folder'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
