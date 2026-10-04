<script lang="ts">
	import '@fontsource-variable/inter';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Turning Points</title>
	<meta name="theme-color" content="#0c0e13" />
</svelte:head>

{@render children()}
