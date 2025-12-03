<script lang="ts">
	import type { PageProps } from './$types';
	import GettingStarted from '$lib/components/onboarding/getting-started.svelte';

	let { data }: PageProps = $props();

	const defaultSite = $derived(
		data.sites.find((site) => site.slug === 'default') || data.sites[0] || null
	);
</script>

<div class="container mx-auto p-6">
	<div class="mx-auto max-w-3xl">
		<!-- Hero Section -->
		<div class="mb-8 space-y-2">
			<h1 class="text-4xl font-bold tracking-tight">Welcome to EmitKit</h1>
			<p class="text-lg text-muted-foreground">
				Send real-time events from all your applications in one place.
			</p>
		</div>

		<!-- Onboarding -->
		<GettingStarted {defaultSite} />

		<!-- Quick Stats (optional future addition) -->
		{#if data.sites.length > 0}
			<div class="mt-8 grid gap-4 md:grid-cols-3">
				<div class="rounded-lg border p-4">
					<div class="text-2xl font-bold">{data.sites.length}</div>
					<div class="text-sm text-muted-foreground">Sites</div>
				</div>
				<!-- Add more stats as needed -->
			</div>
		{/if}
	</div>
</div>
