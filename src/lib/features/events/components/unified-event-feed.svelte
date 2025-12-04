<script lang="ts">
	import { onMount } from 'svelte';
	import { now, parseAbsoluteToLocal, toCalendarDate } from '@internationalized/date';
	import type { Event } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/features/events/types.js';
	import EventListItem from '$lib/features/events/components/event-list-item.svelte';
	import { Wrapper } from '$lib/components/ui/wrapper';
	import type { Site } from '$lib/features/sites/types';
	import type { Channel } from '$lib/features/channels/types';

	let {
		initialEvents,
		sites,
		channels,
		organizationId
	}: {
		initialEvents: PaginatedResult<Event>;
		sites: Site[];
		channels: Channel[];
		organizationId: string;
	} = $props();

	// Track which events are "new" (streamed in after page load)
	type EventWithNewStatus = Event & {
		isNew?: boolean;
		streamedAt?: number; // Timestamp when event was streamed in
	};

	type TimeGroup =
		| 'new'
		| 'last_hour'
		| 'earlier_today'
		| 'yesterday'
		| 'last_7_days'
		| 'last_30_days'
		| 'older';

	type GroupedEvents = {
		group: TimeGroup;
		label: string;
		events: EventWithNewStatus[];
	};

	// Track loaded event IDs to prevent duplicates
	let loadedEventIds = new Set<string>(initialEvents.items.map((event) => event.id));

	// Initialize with server-loaded events (not marked as new)
	let allEvents = $state<EventWithNewStatus[]>(initialEvents.items);

	// Create maps for channel and site lookups
	const siteMap = new Map<string, Site>();
	sites.forEach((site) => siteMap.set(site.id, site));

	const channelMap = new Map<string, Channel>();
	channels.forEach((channel) => channelMap.set(channel.id, channel));

	// Handle event deletion
	function handleEventDeleted(eventId: string) {
		// Remove event from the list
		allEvents = allEvents.filter((event) => event.id !== eventId);
		loadedEventIds.delete(eventId);
	}

	/**
	 * Determine which time group an event belongs to
	 */
	function getTimeGroup(event: EventWithNewStatus, currentTime: Date): TimeGroup {
		// If event was streamed in and is still "new" (< 30s old)
		if (event.isNew && event.streamedAt) {
			const secondsSinceStreamed = (currentTime.getTime() - event.streamedAt) / 1000;
			if (secondsSinceStreamed < 30) {
				return 'new';
			}
		}

		const eventTime = event.createdAt.getTime();
		const currentTimeMs = currentTime.getTime();
		const diffMs = currentTimeMs - eventTime;
		const diffHours = diffMs / (1000 * 60 * 60);
		const diffDays = diffMs / (1000 * 60 * 60 * 24);

		// Last hour (< 1 hour ago)
		if (diffHours < 1) {
			return 'last_hour';
		}

		// Check if event is today
		const eventDate = toCalendarDate(parseAbsoluteToLocal(event.createdAt.toISOString()));
		const todayDate = toCalendarDate(now('UTC'));

		if (eventDate.compare(todayDate) === 0) {
			// Same day - Earlier today (> 1 hour ago)
			return 'earlier_today';
		}

		// Check if event is yesterday
		const yesterdayDate = todayDate.subtract({ days: 1 });
		if (eventDate.compare(yesterdayDate) === 0) {
			return 'yesterday';
		}

		// Last 7 days
		if (diffDays < 7) {
			return 'last_7_days';
		}

		// Last 30 days
		if (diffDays < 30) {
			return 'last_30_days';
		}

		// Older
		return 'older';
	}

	/**
	 * Get display label for a time group
	 */
	function getGroupLabel(group: TimeGroup): string {
		const labels: Record<TimeGroup, string> = {
			new: 'New',
			last_hour: 'Last hour',
			earlier_today: 'Earlier today',
			yesterday: 'Yesterday',
			last_7_days: 'Last 7 days',
			last_30_days: 'Last 30 days',
			older: 'Older'
		};
		return labels[group];
	}

	/**
	 * Group events by time periods
	 */
	const groupedEvents = $derived.by((): GroupedEvents[] => {
		const currentTime = new Date();
		const groups = new Map<TimeGroup, EventWithNewStatus[]>();

		// Initialize all groups in order
		const groupOrder: TimeGroup[] = [
			'new',
			'last_hour',
			'earlier_today',
			'yesterday',
			'last_7_days',
			'last_30_days',
			'older'
		];
		groupOrder.forEach((g) => groups.set(g, []));

		// Assign events to groups
		allEvents.forEach((event) => {
			const group = getTimeGroup(event, currentTime);
			groups.get(group)!.push(event);
		});

		// Convert to array, preserving order, only including non-empty groups
		return groupOrder
			.map((group) => ({
				group,
				label: getGroupLabel(group),
				events: groups.get(group)!
			}))
			.filter((g) => g.events.length > 0);
	});


	onMount(() => {
		const eventSource = new EventSource(`/stream`);

		eventSource.addEventListener('message', async (e) => {
			const message = JSON.parse(e.data);

			if (message.type === 'event' && message.data) {
				// Convert createdAt string to Date object
				const eventData = message.data;
				const streamedAt = Date.now();
				const event: EventWithNewStatus = {
					...eventData,
					createdAt: new Date(eventData.createdAt),
					isNew: true, // Mark as new since it's streaming in real-time
					streamedAt
				};

				// Only add if we haven't seen this event before
				if (!loadedEventIds.has(event.id)) {
					loadedEventIds.add(event.id);
					allEvents = [event, ...allEvents]; // Prepend new events to the top
				}
			}
		});

		// Auto-remove "new" indicator after 30 seconds
		const interval = setInterval(() => {
			const currentTime = Date.now();
			const thirtySecondsAgo = currentTime - 30000;

			allEvents = allEvents.map((event) => {
				if (event.isNew && event.streamedAt && event.streamedAt < thirtySecondsAgo) {
					return { ...event, isNew: false };
				}
				return event;
			});
		}, 5000); // Check every 5 seconds

		return () => {
			eventSource.close();
			clearInterval(interval);
		};
	});
</script>

<Wrapper alignment="center">
	{#if allEvents.length === 0}
		<div class="flex flex-col items-center justify-center gap-4 py-12 text-center">
			<div class="rounded-full bg-muted p-6">
				<svg
					class="size-12 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>
			</div>
			<div class="space-y-2">
				<h3 class="text-lg font-semibold">No events yet</h3>
				<p class="text-sm text-muted-foreground">
					Start sending events from your applications to see them here
				</p>
			</div>
		</div>
	{:else}
		<div class="flex w-full max-w-lg flex-col gap-6 overflow-y-auto">
			{#each groupedEvents as group (group.group)}
				<!-- Group header -->
				<div class="flex flex-col gap-3">
					<h3 class="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
						{group.label}
						<span class="ml-1.5 text-[10px] font-normal">({group.events.length})</span>
					</h3>

					<!-- Events in this group -->
					<div class="flex flex-col gap-3">
						{#each group.events as event (event.id)}
							{@const site = siteMap.get(event.siteId)}
							{@const channel = channelMap.get(event.channelId)}
							<EventListItem
								{event}
								isNew={event.isNew ?? false}
								channelId={event.channelId}
								{organizationId}
								onDeleted={() => handleEventDeleted(event.id)}
								siteName={site?.name}
								siteSlug={site?.slug}
								channelName={channel?.name}
								showChannelContext={true}
							/>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Wrapper>
