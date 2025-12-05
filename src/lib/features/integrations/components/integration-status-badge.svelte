<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	let {
		status,
		variant = 'default'
	}: {
		status: 'connected' | 'coming_soon' | 'disabled';
		variant?: 'default' | 'secondary' | 'outline' | 'destructive';
	} = $props();

	const labels: Record<string, string> = {
		connected: 'Connected',
		coming_soon: 'Coming Soon',
		disabled: 'Disabled'
	};

	const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
		connected: 'default',
		coming_soon: 'secondary',
		disabled: 'outline'
	};
</script>

<Badge variant={variantMap[status]}>{labels[status]}</Badge>
