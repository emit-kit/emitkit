<script lang="ts">
	import SidebarLeft from '$lib/components/app/sidebar-left.svelte';
	// import SidebarRight from '$lib/components/app/sidebar-right.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { createBreadcrumbActionsContext } from '$lib/context/breadcrumb-actions.svelte';
	import { createPageActionsContext } from '$lib/context/page-actions.svelte';
	import { ModalStackProvider } from '$lib/components/modal-stack';

	let { children, data } = $props();

	const breadcrumbActions = createBreadcrumbActionsContext();
	const pageActions = createPageActionsContext();
</script>

<ModalStackProvider>
	<Sidebar.Provider>
		<SidebarLeft />

		<Sidebar.Inset>
			<header class="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b bg-background">
				<div class="flex flex-1 items-center gap-2 px-3">
					<Sidebar.Trigger />

					{#if breadcrumbActions.action}
						<div class="ml-auto">
							<breadcrumbActions.action.component {...breadcrumbActions.action.props} />
						</div>
					{/if}
				</div>
			</header>

			<!-- Page Actions Bar -->
			{#if pageActions.leftActions.length > 0 || pageActions.rightActions.length > 0}
				<div class="flex items-center justify-between gap-4 border-b bg-background px-3 py-2.5">
					<div class="flex items-center gap-2">
						{#each pageActions.leftActions as action (action.actionId)}
							{#if action?.component && action?.props}
								<action.component {...action.props} />
							{/if}
						{/each}
					</div>
					<div class="flex items-center gap-2">
						{#each pageActions.rightActions as action (action.actionId)}
							{#if action?.component && action?.props}
								<action.component {...action.props} />
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex flex-1 flex-col gap-4 p-4">
				{@render children()}
			</div>
		</Sidebar.Inset>

		<!-- <SidebarRight /> -->
	</Sidebar.Provider>
</ModalStackProvider>
