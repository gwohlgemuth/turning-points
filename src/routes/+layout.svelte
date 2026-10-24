<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { asset, resolve } from '$app/paths';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import Analysis from '#lib/components/Analysis.svelte';
	import { withDemo } from '#lib/demo/mode.ts';
	import { sound } from '#lib/sound.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	if (browser) sound.enabled = untrack(() => data.preferences.sound);

	// The service worker serves the cached version first; reload once a new one takes over
	if (browser && import.meta.env.STATIC && navigator.serviceWorker?.controller) {
		navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
			once: true
		});
	}

	onNavigate((navigation) => {
		const from = navigation.from?.route.id;
		const to = navigation.to?.route.id;
		if (!document.startViewTransition || prefersReducedMotion.current || !from || from === to)
			return;
		document.documentElement.toggleAttribute('data-scrolled', scrollY > 0);
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<title>Turning Points</title>
	<meta name="theme-color" content="#0c0e13" />
	{#if import.meta.env.STATIC}
		<link rel="manifest" href={asset('manifest.webmanifest')} />
		<link rel="apple-touch-icon" href={asset('apple-touch-icon.png')} />
		<meta name="mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black" />
	{/if}
</svelte:head>

<Analysis preferences={data.preferences} active={page.route.id === '/'} />
{@render children()}

{#if import.meta.env.STATIC}
	<footer>
		<a href="https://gwohl.de/impressum">Legal notice</a>
		<a href={withDemo(resolve('/privacy'))}>Privacy</a>
	</footer>
{/if}

<style>
	footer {
		display: flex;
		justify-content: center;
		gap: 18px;
		padding: 0 20px 24px;
		font-size: 0.8rem;
	}

	footer a {
		color: var(--muted);
		text-decoration: none;
	}

	footer a:hover {
		color: var(--text);
	}
</style>
