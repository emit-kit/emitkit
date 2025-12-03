<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/client/auth/auth-client';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let message = $state('Checking authentication...');

	onMount(async () => {
		try {
			// Check if session exists (should be set by cookie from magic link verification)
			const session = await authClient.getSession();

			if (session.data) {
				status = 'success';
				message = 'Successfully authenticated! Redirecting...';

				// Redirect to dashboard after a brief moment
				setTimeout(() => {
					goto('/');
				}, 1000);
			} else {
				status = 'error';
				message = 'Session not found. The authentication may have failed or expired.';
			}
		} catch (error) {
			console.error('PWA authentication error:', error);
			status = 'error';
			message = 'Authentication failed. Please try again.';
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="text-center">
		{#if status === 'loading'}
			<div class="mb-4 flex justify-center">
				<div class="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
			</div>
			<h2 class="text-xl font-semibold">{message}</h2>
		{:else if status === 'success'}
			<div class="mb-4 flex justify-center">
				<svg class="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-green-500">{message}</h2>
		{:else}
			<div class="mb-4 flex justify-center">
				<svg class="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-red-500">{message}</h2>
			<button
				onclick={() => goto('/auth/sign-in')}
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
			>
				Return to Sign In
			</button>
		{/if}
	</div>
</div>
