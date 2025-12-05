<script lang="ts">
	import { cn } from '$lib/utils/ui';
	import type { WithElementRef } from 'bits-ui';
	import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';

	export type Props = WithElementRef<HTMLAttributes<HTMLDivElement>> &
		WithElementRef<HTMLAnchorAttributes> & {
			wrapperClass?: string;
		};

	let { wrapperClass, href = '/' }: Props = $props();

	const computedWrapperClass = $derived(
		cn(
			'group/logo flex min-w-0 flex-row place-content-start items-center gap-x-2 gap-y-1',
			wrapperClass
		)
	);
</script>

{#if href}
	<a {href} class={computedWrapperClass}>
		<span class="text-xl font-semibold tracking-tight">EmitKit</span>
	</a>
{:else}
	<div class={computedWrapperClass}>
		<span class="text-xl font-semibold tracking-tight">EmitKit</span>
	</div>
{/if}
