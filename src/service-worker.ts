/**
 * Service Worker - PWA + Push Notifications
 *
 * Handles:
 * - Asset caching for offline support
 * - Push notification reception and display
 * - Background sync for failed requests
 */

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `cache-${version}`;
const ASSETS = [...build, ...files];

/**
 * Install event - cache all static assets
 */
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => {
				sw.skipWaiting();
			})
	);
});

/**
 * Activate event - clean up old caches
 */
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE_NAME) await caches.delete(key);
			}
			sw.clients.claim();
		})
	);
});

/**
 * Fetch event - serve from cache, fallback to network
 * Strategy: NetworkFirst for API calls, CacheFirst for static assets
 */
sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip cross-origin requests
	if (url.origin !== location.origin) return;

	// Never cache auth-related pages - they need fresh session data
	const isAuthPage =
		url.pathname.startsWith('/auth/') || url.pathname.includes('pwa-callback');

	if (isAuthPage) {
		event.respondWith(fetch(event.request));
		return;
	}

	// API routes: NetworkFirst (prioritize fresh data)
	if (url.pathname.startsWith('/api/')) {
		// NEVER cache authentication endpoints - they must always be fresh
		const isAuthEndpoint =
			url.pathname.startsWith('/api/auth/') ||
			url.pathname.includes('magic-link') ||
			url.pathname.includes('session') ||
			url.pathname.includes('sign-in') ||
			url.pathname.includes('sign-up');

		if (isAuthEndpoint) {
			// Bypass cache entirely for auth endpoints
			event.respondWith(fetch(event.request));
			return;
		}

		// For other API routes, use NetworkFirst with caching
		event.respondWith(
			fetch(event.request)
				.then(async (response) => {
					// Cache successful responses
					if (response.ok) {
						const responseClone = response.clone();
						const cache = await caches.open(CACHE_NAME);
						cache.put(event.request, responseClone);
					}
					return response;
				})
				.catch(() => {
					// Fallback to cache if network fails
					return caches.match(event.request).then((cached) => {
						if (cached) return cached;
						return new Response('Offline', { status: 503 });
					});
				})
		);
		return;
	}

	// Static assets: CacheFirst (faster loading)
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;

			return fetch(event.request).then(async (response) => {
				// Cache new resources
				if (response.ok && ASSETS.includes(url.pathname)) {
					const responseClone = response.clone();
					const cache = await caches.open(CACHE_NAME);
					cache.put(event.request, responseClone);
				}
				return response;
			});
		})
	);
});

/**
 * Push event - receive and display push notifications
 */
sw.addEventListener('push', (event) => {
	if (!event.data) return;

	try {
		const data = event.data.json();

		// Extract notification data
		const title = data.title || 'New Event';
		const options: NotificationOptions = {
			body: data.body || data.description || '',
			icon: data.icon || '/pwa-192x192.png',
			badge: '/pwa-64x64.png',
			tag: data.tag || data.eventId || 'notification',
			data: data.data || data,
			requireInteraction: data.requireInteraction || false,
			actions: data.actions || [],
			vibrate: [200, 100, 200]
		};

		event.waitUntil(sw.registration.showNotification(title, options));
	} catch (error) {
		console.error('Error processing push notification:', error);
	}
});

/**
 * Notification click event - handle notification clicks
 */
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const data = event.notification.data;
	const urlToOpen = data?.url || data?.channelUrl || '/';

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// Check if there's already a window open
			for (const client of clientList) {
				if (client.url === urlToOpen && 'focus' in client) {
					return client.focus();
				}
			}

			// Open new window if none exists
			if (sw.clients.openWindow) {
				return sw.clients.openWindow(urlToOpen);
			}
		})
	);
});

/**
 * Background sync - retry failed requests
 */
sw.addEventListener('sync', (event) => {
	if (event.tag === 'sync-events') {
		event.waitUntil(syncEvents());
	}
});

/**
 * Sync failed event creations
 */
async function syncEvents() {
	// Implementation for background sync
	// This would retry any failed API calls stored in IndexedDB
	console.log('Background sync triggered');
}
