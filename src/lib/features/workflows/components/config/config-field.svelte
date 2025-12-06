<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import type { TriggerConfig, ActionConfig } from '$lib/features/workflows/types';

	type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'url' | 'email';

	interface Props {
		label: string;
		type: FieldType;
		value: string | number | string[] | undefined;
		onchange: (value: string | number | string[]) => void;
		placeholder?: string;
		description?: string;
		required?: boolean;
		options?: Array<{ value: string; label: string }>;
		multiple?: boolean;
		disabled?: boolean;
	}

	let {
		label,
		type,
		value = '',
		onchange,
		placeholder = '',
		description,
		required = false,
		options = [],
		multiple = false,
		disabled = false
	}: Props = $props();

	// Convert value to string for select components
	let selectedValue = $state<string | undefined>(
		value !== undefined && value !== null ? String(value) : undefined
	);

	// Update selectedValue when value prop changes
	$effect(() => {
		selectedValue = value !== undefined && value !== null ? String(value) : undefined;
	});

	// Trigger onchange when selectedValue changes (for select)
	$effect(() => {
		if (type === 'select' && selectedValue !== undefined) {
			onchange(selectedValue);
		}
	});
</script>

<div class="space-y-2">
	<div class="flex items-center gap-2">
		<Label for={label} class="text-sm font-medium">
			{label}
			{#if required}
				<span class="text-destructive">*</span>
			{/if}
		</Label>
	</div>

	{#if description}
		<p class="text-xs text-muted-foreground">{description}</p>
	{/if}

	{#if type === 'text' || type === 'url' || type === 'email' || type === 'number'}
		<Input
			id={label}
			type={type}
			value={String(value || '')}
			oninput={(e) => {
				const newValue = e.currentTarget.value;
				onchange(type === 'number' && newValue ? Number(newValue) : newValue);
			}}
			{placeholder}
			{disabled}
			{required}
		/>
	{:else if type === 'textarea'}
		<Textarea
			id={label}
			value={String(value || '')}
			oninput={(e) => onchange(e.currentTarget.value)}
			{placeholder}
			{disabled}
			{required}
			rows={4}
		/>
	{:else if type === 'select'}
		{@const selectedOption = options.find((o) => o.value === selectedValue)}
		<Select.Root type="single" bind:value={selectedValue} {disabled}>
			<Select.Trigger class="w-full">
				{selectedOption?.label || placeholder || 'Select...'}
			</Select.Trigger>
			<Select.Content>
				{#each options as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{/if}
</div>
