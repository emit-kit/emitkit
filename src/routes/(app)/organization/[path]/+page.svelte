<script lang="ts">
	import { OrganizationView } from 'better-auth-ui-svelte';
	import type { PageProps } from './$types.js';

	let { data, params }: PageProps = $props();
</script>

<OrganizationView path={params.path} />
