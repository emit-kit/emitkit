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

	let { data, children } = $props();

	setSiteConfig(data.config);
	const config = useSiteConfig();
</script>

{#if config.flags.darkMode}
	<ModeWatcher />
{/if}

<Toaster />

<AuthUIProvider {authClient} credentials={true} magicLink={true} {toast}>
	<ModalStackProvider>
		{@render children()}
	</ModalStackProvider>
</AuthUIProvider>
