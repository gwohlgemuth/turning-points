import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { asset, resolve } from '$app/paths';
import { self } from '$app/service-worker';
import type { AssetPath } from '$app/types';

const CACHE = `cache-${version}`;
const ASSETS = new Set([
	...[...immutable, ...assets].map(({ path }) => asset(path as AssetPath)),
	...prerendered.map(({ path }) => resolve(path))
]);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

async function respond(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const { pathname } = new URL(request.url);
	if (ASSETS.has(pathname)) {
		const cached = await cache.match(pathname);
		if (cached) return cached;
	}
	try {
		return await fetch(request);
	} catch (err) {
		const cached = await cache.match(request, { ignoreSearch: true });
		if (cached) return cached;
		throw err;
	}
}

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	if (new URL(event.request.url).origin !== location.origin) return;
	event.respondWith(respond(event.request));
});
