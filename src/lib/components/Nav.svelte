<script lang="ts">
	import { browser } from '$app/env';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { withDemo } from '#lib/demo/mode.ts';
	import { updatePreferences } from '#lib/preferences.ts';
	import { sound } from '#lib/sound.svelte.ts';

	const LINKS = [
		{ route: '/', label: 'Analysis' },
		{ route: '/review', label: 'Review' },
		{ route: '/stats', label: 'Stats' },
		{ route: '/guide', label: 'Guide' }
	] as const;

	let soundOn = $derived(browser ? sound.enabled : page.data.preferences?.sound !== false);

	function toggleSound() {
		sound.enabled = !sound.enabled;
		updatePreferences({ sound: sound.enabled });
	}
</script>

<nav aria-label="Main">
	{#each LINKS as link (link.route)}
		{@const current = page.route.id === link.route}
		<a
			href={withDemo(resolve(link.route))}
			class:current
			aria-current={current ? 'page' : undefined}
			>{link.label}{#if current}<span class="indicator"></span>{/if}</a
		>
	{/each}
	<button
		class="sound"
		onclick={toggleSound}
		aria-pressed={soundOn}
		title={soundOn ? 'Sound on' : 'Sound off'}>{soundOn ? '🔊' : '🔇'}</button
	>
</nav>

<style>
	nav {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		min-height: 46px;
		gap: 18px;
		view-transition-name: site-nav;
	}

	a {
		position: relative;
		padding: 4px 0;
		color: var(--accent-2);
		text-decoration: none;
	}

	a:hover {
		color: var(--text);
	}

	a.current {
		color: var(--text);
	}

	.sound {
		padding: 4px 8px;
		margin-left: -4px;
	}

	.indicator {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent);
		view-transition-name: nav-indicator;
	}
</style>
