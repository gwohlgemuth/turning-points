<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import Analysis from '#lib/components/Analysis.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Turning Points</title>
	<meta name="theme-color" content="#0c0e13" />
</svelte:head>

<Analysis preferences={data.preferences} active={page.route.id === '/'} />
{@render children()}
