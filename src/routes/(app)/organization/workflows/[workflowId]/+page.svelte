<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Switch } from '$lib/components/ui/switch';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import WorkflowCanvas from '$lib/features/workflows/components/workflow-canvas.svelte';
	import { workflowStore } from '$lib/features/workflows/stores/workflow-store.svelte';
	import { updateWorkflowCommand } from '$lib/features/workflows/workflows.remote';
	import { goto } from '$app/navigation';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { toast } from 'svelte-sonner';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SaveIcon from '@lucide/svelte/icons/save';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import ZapOffIcon from '@lucide/svelte/icons/zap-off';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import type { WorkflowNode } from '$lib/features/workflows/types';
	import type { Node } from '@xyflow/svelte';

	let { data }: { data: PageData } = $props();

	// Workflow metadata state (editable)
	let workflowName = $derived(data.workflow.name);
	let workflowDescription = $derived(data.workflow.description || '');
	let workflowEnabled = $derived(data.workflow.enabled);
	let isSavingMetadata = $state(false);

	// Sync state with prop changes (e.g., when navigating between workflows)
	$effect(() => {
		workflowName = data.workflow.name;
		workflowDescription = data.workflow.description || '';
		workflowEnabled = data.workflow.enabled;
	});

	// Selected node for configuration
	let selectedNode = $state<Node<WorkflowNode['data'], WorkflowNode['type']> | null>(null);
	let showRightSidebar = $state(false);

	// Node palette data
	const triggerNodes = [
		{
			type: 'trigger' as const,
			label: 'Folder Event',
			description: 'Trigger on events in a folder',
			config: { triggerType: 'folder' as const, folderId: '' }
		},
		{
			type: 'trigger' as const,
			label: 'Channel Event',
			description: 'Trigger on events in a channel',
			config: { triggerType: 'channel' as const, channelId: '' }
		},
		{
			type: 'trigger' as const,
			label: 'Event Type',
			description: 'Trigger on specific event types',
			config: { triggerType: 'event_type' as const, eventTypes: [] }
		},
		{
			type: 'trigger' as const,
			label: 'Tag Match',
			description: 'Trigger on events with specific tags',
			config: { triggerType: 'tag' as const, tags: [] }
		}
	];

	const actionNodes = [
		{
			type: 'action' as const,
			label: 'Send to Slack',
			description: 'Post message to Slack channel',
			config: { actionType: 'slack' as const, webhookUrl: '', messageTemplate: '' }
		},
		{
			type: 'action' as const,
			label: 'Send to Discord',
			description: 'Post message to Discord channel',
			config: { actionType: 'discord' as const, webhookUrl: '', messageTemplate: '' }
		},
		{
			type: 'action' as const,
			label: 'Send Email',
			description: 'Send email notification',
			config: { actionType: 'email' as const, to: '', subject: '', body: '' }
		},
		{
			type: 'action' as const,
			label: 'HTTP Request',
			description: 'Make HTTP request to webhook',
			config: {
				actionType: 'http' as const,
				httpMethod: 'POST' as const,
				endpoint: '',
				headers: {},
				httpBody: ''
			}
		},
		{
			type: 'action' as const,
			label: 'Condition',
			description: 'Branch based on condition',
			config: { actionType: 'condition' as const, condition: '' }
		}
	];

	// Save workflow metadata
	async function saveMetadata() {
		isSavingMetadata = true;
		try {
			await updateWorkflowCommand({
				workflowId: data.workflow.id,
				name: workflowName,
				description: workflowDescription || undefined,
				enabled: workflowEnabled
			});
			toast.success('Workflow settings saved');
		} catch (error) {
			console.error('Failed to save workflow metadata:', error);
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to save workflow settings';
			toast.error(errorMessage);
		} finally {
			isSavingMetadata = false;
		}
	}

	// Handle node click
	function handleNodeClick(node: Node<WorkflowNode['data'], WorkflowNode['type']>) {
		selectedNode = node;
		showRightSidebar = true;
	}

	// Handle canvas click (deselect node)
	function handleCanvasClick() {
		selectedNode = null;
		showRightSidebar = false;
	}

	// Add node to canvas
	function addNode(nodeTemplate: (typeof triggerNodes)[0] | (typeof actionNodes)[0]) {
		const centerX = 400;
		const centerY = 300;
		const randomOffset = () => Math.floor(Math.random() * 100) - 50;

		workflowStore.addNode(
			nodeTemplate.type,
			{ x: centerX + randomOffset(), y: centerY + randomOffset() },
			{
				label: nodeTemplate.label,
				description: nodeTemplate.description,
				config: nodeTemplate.config
			}
		);
	}

	// Handle drag start for node palette
	function handleDragStart(
		event: DragEvent,
		nodeTemplate: (typeof triggerNodes)[0] | (typeof actionNodes)[0]
	) {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/json', JSON.stringify(nodeTemplate));
	}
</script>

<div class="flex h-screen flex-col">
	<!-- Top Toolbar -->
	<div class="border-b bg-card">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center gap-4">
				<Button variant="ghost" size="sm" onclick={() => goto('/organization/workflows')}>
					<ArrowLeftIcon class="h-4 w-4" />
				</Button>
				<Separator orientation="vertical" class="h-6" />
				<div class="flex items-center gap-3">
					<Input
						type="text"
						bind:value={workflowName}
						class="max-w-xs border-none text-lg font-semibold focus-visible:ring-1"
						placeholder="Workflow name"
						onblur={saveMetadata}
					/>
					<Badge variant={workflowEnabled ? 'default' : 'secondary'}>
						{#if workflowEnabled}
							<ZapIcon class="mr-1 h-3 w-3" />
							Active
						{:else}
							<ZapOffIcon class="mr-1 h-3 w-3" />
							Disabled
						{/if}
					</Badge>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<div class="flex items-center gap-2">
					<Switch id="enabled" bind:checked={workflowEnabled} onchange={saveMetadata} />
					<Label for="enabled" class="text-sm">Enable</Label>
				</div>
				<Separator orientation="vertical" class="h-6" />
				<Button
					variant="outline"
					size="sm"
					onclick={() => workflowStore.forceSave()}
					disabled={!workflowStore.isDirty}
				>
					<SaveIcon class="mr-2 h-4 w-4" />
					{workflowStore.isDirty ? 'Save' : 'Saved'}
				</Button>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left Sidebar - Node Palette -->
		<div class="w-64 overflow-y-auto border-r bg-muted/30 p-4">
			<div class="space-y-6">
				<!-- Triggers Section -->
				<div>
					<h3
						class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground/70 uppercase"
					>
						<PlayIcon class="h-4 w-4" />
						Triggers
					</h3>
					<div class="space-y-2">
						{#each triggerNodes as node (node.label)}
							<Card.Root
								class="cursor-move transition-colors hover:border-indigo-400 hover:bg-card"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, node)}
								onclick={() => addNode(node)}
							>
								<Card.Header class="p-3">
									<Card.Title class="text-sm">{node.label}</Card.Title>
									<Card.Description class="text-xs">
										{node.description}
									</Card.Description>
								</Card.Header>
							</Card.Root>
						{/each}
					</div>
				</div>

				<!-- Actions Section -->
				<div>
					<h3
						class="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground/70 uppercase"
					>
						<ZapIcon class="h-4 w-4" />
						Actions
					</h3>
					<div class="space-y-2">
						{#each actionNodes as node (node.label)}
							<Card.Root
								class="cursor-move transition-colors hover:border-purple-400 hover:bg-card"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, node)}
								onclick={() => addNode(node)}
							>
								<Card.Header class="p-3">
									<Card.Title class="text-sm">{node.label}</Card.Title>
									<Card.Description class="text-xs">
										{node.description}
									</Card.Description>
								</Card.Header>
							</Card.Root>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Canvas -->
		<div class="flex-1">
			<SvelteFlowProvider>
				<WorkflowCanvas
					workflowId={data.workflow.id}
					initialNodes={data.workflow.nodes}
					initialEdges={data.workflow.edges}
					onNodeClick={handleNodeClick}
					onCanvasClick={handleCanvasClick}
				/>
			</SvelteFlowProvider>
		</div>

		<!-- Right Sidebar - Node Configuration -->
		{#if showRightSidebar && selectedNode}
			<div class="w-80 overflow-y-auto border-l bg-card p-4">
				<div class="space-y-4">
					<div class="flex items-center gap-2">
						<SettingsIcon class="h-5 w-5 text-muted-foreground" />
						<h3 class="text-lg font-semibold">Node Configuration</h3>
					</div>

					<Separator />

					<div class="space-y-4">
						<div>
							<Label for="node-label">Label</Label>
							<Input
								id="node-label"
								value={selectedNode.data.label}
								onchange={(e) => {
									if (selectedNode) {
										workflowStore.updateNode(selectedNode.id, {
											label: e.currentTarget.value
										});
									}
								}}
							/>
						</div>

						<div>
							<Label for="node-description">Description</Label>
							<Textarea
								id="node-description"
								value={selectedNode.data.description || ''}
								onchange={(e) => {
									if (selectedNode) {
										workflowStore.updateNode(selectedNode.id, {
											description: e.currentTarget.value
										});
									}
								}}
							/>
						</div>

						<!-- Node-specific config would go here -->
						<div class="rounded-lg bg-muted p-3">
							<p class="text-xs text-muted-foreground">
								Node type: <strong>{selectedNode.type}</strong>
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Additional configuration options will be displayed here based on the node type.
							</p>
						</div>

						<Separator />

						<Button
							variant="destructive"
							size="sm"
							class="w-full"
							onclick={() => {
								if (selectedNode) {
									workflowStore.deleteNode(selectedNode.id);
									selectedNode = null;
									showRightSidebar = false;
								}
							}}
						>
							Delete Node
						</Button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
