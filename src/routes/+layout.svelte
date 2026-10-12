<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import Analysis from '#lib/components/Analysis.svelte';
	import { sound } from '#lib/sound.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	if (browser) sound.enabled = untrack(() => data.preferences.sound);

	const ORDER = ['/', '/review', '/stats', '/guide'];

	onNavigate((navigation) => {
		const from = navigation.from?.route.id;
		const to = navigation.to?.route.id;
		if (!document.startViewTransition || prefersReducedMotion.current || !from || from === to)
			return;
		const back = ORDER.indexOf(to ?? '') < ORDER.indexOf(from);
		document.documentElement.dataset.direction = back ? 'back' : 'forward';
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
</svelte:head>

<Analysis preferences={data.preferences} active={page.route.id === '/'} />
{@render children()}
