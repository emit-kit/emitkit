<script lang="ts">
	import { Heading, type HeadingProps } from '$lib/components/ui/heading';

	interface Props extends HeadingProps {}

	let { size = 'pageTitle', as = 'h1', class: className, children, ...restProps }: Props = $props();
</script>

<Heading {size} class={className} {...restProps} animate={true}>
	{@render children?.()}
</Heading>
