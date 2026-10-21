import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { asset, resolve } from '$app/paths';
import { self } from '$app/service-worker';
import type { AssetPath } from '$app/types';
import { SHARED_CACHE, SHARED_FILE } from '../lib/share.ts';

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
				Promise.all(
					keys
						.filter((key) => key !== CACHE && key !== SHARED_CACHE)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

async function respond(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const { pathname } = new URL(request.url);
	if (ASSETS.has(pathname)) {
		const cached = await cache.match(pathname);
		// A fresh Response keeps the request URL, including the #wasm path the Stockfish worker reads
		if (cached) return new Response(cached.body, cached);
	}
	try {
		return await fetch(request);
	} catch (err) {
		const cached = await cache.match(request, { ignoreSearch: true });
		if (cached) return cached;
		throw err;
	}
}

// The Android share target posts the shared sync file here; the Stats page picks it up
async function receiveShare(request: Request): Promise<Response> {
	const file = (await request.formData()).get('file');
	if (file instanceof File)
		await (await caches.open(SHARED_CACHE)).put(SHARED_FILE, new Response(file));
	return Response.redirect(`${resolve('/stats')}?shared`, 303);
}

self.addEventListener('fetch', (event) => {
	const { pathname } = new URL(event.request.url);
	if (event.request.method === 'POST' && pathname === resolve('/stats')) {
		event.respondWith(receiveShare(event.request));
		return;
	}
	if (event.request.method !== 'GET') return;
	if (new URL(event.request.url).origin !== location.origin) return;
	event.respondWith(respond(event.request));
});
