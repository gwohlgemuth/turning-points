<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { prefersReducedMotion } from 'svelte/motion';
	import favicon from '#lib/assets/favicon.svg';
	import Analysis from '#lib/components/Analysis.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

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
	<link rel="icon" href={favicon} />
	<title>Turning Points</title>
	<meta name="theme-color" content="#0c0e13" />
</svelte:head>

<Analysis preferences={data.preferences} active={page.route.id === '/'} />
{@render children()}
