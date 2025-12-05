<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
	{#each Array(6) as _, i (i)}
		<div class="rounded-lg border bg-card p-6">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<Skeleton class="h-10 w-10 rounded-lg" />
					<div class="space-y-2">
						<Skeleton class="h-5 w-24" />
					</div>
				</div>
				<Skeleton class="h-5 w-16" />
			</div>
			<Skeleton class="mt-4 h-12 w-full" />
			<Skeleton class="mt-4 h-10 w-full" />
		</div>
	{/each}
</div>
