<script lang="ts">
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/inter/700.css';
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { AuthUIProvider } from 'better-auth-ui-svelte';
	import { authClient } from '$lib/client/auth/auth-client';
	import { toast, Toaster } from 'svelte-sonner';
	import { setSiteConfig, useSiteConfig } from '$lib/hooks/use-site-config.svelte';
	import ModalStackProvider from '$lib/components/modal-stack/modal-stack-provider.svelte';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';

	let { data, children } = $props();

	setSiteConfig(data.config);
	const config = useSiteConfig();

	// Register service worker for PWA functionality
	onMount(() => {
		if ('serviceWorker' in navigator && !dev) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered:', registration);
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		}
	});
</script>

{#if config.flags.darkMode}
	<ModeWatcher />
{/if}

<Toaster />

<AuthUIProvider {authClient} credentials={true} emailOTP={true} {toast}>
	<ModalStackProvider>
		{@render children()}
	</ModalStackProvider>
</AuthUIProvider>
