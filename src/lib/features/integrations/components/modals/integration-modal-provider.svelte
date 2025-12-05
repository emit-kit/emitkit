<script lang="ts" module>
	import type { IntegrationModalStack } from './integration-modal-config.js';
	import { getContext, setContext } from 'svelte';

	const _contextKey = '$$_integrationModalStack';

	export function useIntegrationModals(): IntegrationModalStack & { popAll: () => void } {
		const client = getContext<IntegrationModalStack>(_contextKey);

		if (!client) {
			throw new Error(
				'No integration modal stack was found in Svelte context. Did you forget to wrap your component with IntegrationModalProvider?'
			);
		}

		return Object.assign(client, {
			popAll: () => {
				while (client.items.length > 0) {
					client.pop();
				}
			}
		});
	}

	export function setIntegrationModalStack(context: IntegrationModalStack): void {
		setContext(_contextKey, context);
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { integrationModalStack } from './integration-modal-config.js';
	import { onNavigate } from '$app/navigation';

	const { children }: { children: Snippet } = $props();

	setIntegrationModalStack(integrationModalStack);

	const ms = useIntegrationModals();

	onNavigate(() => {
		ms.popAll();
	});
</script>

{#each ms.items as item (item.config.id)}
	<item.config.component {item} {...item.config.props} />
{/each}

{@render children()}
