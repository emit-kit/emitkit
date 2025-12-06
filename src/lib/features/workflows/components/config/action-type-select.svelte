<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import { actionTemplates, type ActionTemplate } from '$lib/features/workflows/action-templates';

	interface Props {
		value: string;
		onSelect: (templateId: string) => void;
	}

	let { value, onSelect }: Props = $props();

	// Find the current template based on value (actionType)
	const currentTemplate = $derived.by(() => {
		return actionTemplates.find((t) => t.config.actionType === value);
	});

	// Get the selected value (template ID)
	const selectedTemplateId = $derived(currentTemplate?.id);

	function handleValueChange(templateId: string | undefined) {
		if (templateId) {
			onSelect(templateId);
		}
	}
</script>

<Select.Root type="single" value={selectedTemplateId} onValueChange={handleValueChange}>
	<Select.Trigger class="w-full">
		{#if currentTemplate}
			<div class="flex items-center gap-2">
				{#if currentTemplate.iconUrl}
					<img
						src={currentTemplate.iconUrl}
						alt={currentTemplate.name}
						class="h-4 w-4"
						onerror={(e) => {
							const target = e.currentTarget;
							if (target instanceof HTMLImageElement) {
								target.style.display = 'none';
							}
						}}
					/>
				{:else}
					<ZapIcon class="h-4 w-4" />
				{/if}
				<span class="truncate">{currentTemplate.name}</span>
			</div>
		{:else}
			<span class="text-muted-foreground">Select an action...</span>
		{/if}
	</Select.Trigger>
	<Select.Content>
		{#each actionTemplates as template (template.id)}
			<Select.Item value={template.id}>
				<div class="flex items-start gap-3">
					<!-- Icon -->
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
						{#if template.iconUrl}
							<img
								src={template.iconUrl}
								alt={template.name}
								class="h-5 w-5"
								onerror={(e) => {
									const target = e.currentTarget;
									if (target instanceof HTMLImageElement) {
										target.style.display = 'none';
									}
								}}
							/>
						{:else}
							<ZapIcon class="h-4 w-4 text-muted-foreground" />
						{/if}
					</div>
					<!-- Text -->
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-sm font-medium leading-tight">{template.name}</span>
						<span class="text-xs text-muted-foreground leading-tight"
							>{template.description}</span
						>
					</div>
				</div>
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
