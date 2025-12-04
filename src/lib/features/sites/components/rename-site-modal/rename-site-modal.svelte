<script lang="ts">
	import type { StackItemProps } from '@svelte-put/async-stack';
	import { updateSiteForm } from '$lib/features/sites/sites.remote';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';

	// Props interface
	interface Props {
		siteId: string;
		organizationId: string;
		currentName: string;
	}

	// Component props with StackItemProps for modal integration
	let {
		item,
		siteId,
		organizationId,
		currentName
	}: StackItemProps<{ success: boolean; siteName?: string }> & Props = $props();

	// Create a unique form instance for this modal using a unique key
	const formKey = `rename-site-modal-${Math.random().toString(36).substring(2, 9)}`;
	const form = updateSiteForm.for(formKey);

	// Helper to safely get field issues
	type FormField = {
		issues?: () => Array<{ message: string }> | undefined;
	};

	function getIssues(field: FormField | undefined): Array<{ message: string }> {
		return field?.issues?.() ?? [];
	}

	// Watch for pending state (pending is a counter of pending requests)
	const isPending = $derived(form.pending > 0);
	let error = $state<string | null>(null);

	// Handle cancel
	function handleCancel() {
		item.resolve({ success: false });
	}

	// Watch for successful submission
	let previousPending = $state(form.pending);
	$effect(() => {
		// When form transitions from pending (1+) to not pending (0)
		if (previousPending > 0 && form.pending === 0) {
			// Check if there are no field errors (successful submission)
			const hasErrors =
				form.fields.name.issues()?.length ||
				form.fields.siteId.issues()?.length ||
				form.fields.organizationId.issues()?.length;

			if (!hasErrors) {
				// Submission was successful
				const newName = form.fields.name.value();
				item.resolve({
					success: true,
					siteName: newName
				});
			}
		}
		previousPending = form.pending;
	});
</script>

<Dialog.Root open={true}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Rename Site</Dialog.Title>
			<Dialog.Description>
				Update the name of your site. This will not affect the site slug or URL.
			</Dialog.Description>
		</Dialog.Header>

		<form {...form} class="space-y-6">
			<!-- Hidden siteId and organizationId fields -->
			<input {...form.fields.siteId.as('text')} type="hidden" value={siteId} />
			<input {...form.fields.organizationId.as('text')} type="hidden" value={organizationId} />

			<!-- Error Display -->
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Title>Error</Alert.Title>
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}

			<Field.Group>
				<!-- Site Name -->
				<Field.Field data-invalid={getIssues(form.fields.name).length > 0}>
					<Field.Label for="site-name">Site Name *</Field.Label>
					<Input
						id="site-name"
						placeholder="Enter site name"
						{...form.fields.name.as('text')}
						value={currentName}
						aria-invalid={getIssues(form.fields.name).length > 0}
					/>
					<Field.Description>Choose a descriptive name for your site</Field.Description>
					{#each getIssues(form.fields.name) as issue, i (i)}
						<Field.Error>{issue.message}</Field.Error>
					{/each}
				</Field.Field>
			</Field.Group>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={handleCancel} disabled={isPending}>
					Cancel
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ? 'Saving...' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
