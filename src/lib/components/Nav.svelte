<script lang="ts">
	import { page } from '$app/state';
	import { updatePreferences } from '#lib/preferences.ts';
	import { sound } from '#lib/sound.svelte.ts';

	const LINKS = [
		{ href: '/', label: 'Analysis' },
		{ href: '/review', label: 'Review' },
		{ href: '/stats', label: 'Stats' },
		{ href: '/guide', label: 'Guide' }
	];

	function toggleSound() {
		sound.enabled = !sound.enabled;
		updatePreferences({ sound: sound.enabled });
	}
</script>

<nav aria-label="Main">
	{#each LINKS as link (link.href)}
		{@const current = page.route.id === link.href}
		<a href={link.href} class:current aria-current={current ? 'page' : undefined}
			>{link.label}{#if current}<span class="indicator"></span>{/if}</a
		>
	{/each}
	<button
		class="sound"
		onclick={toggleSound}
		aria-pressed={sound.enabled}
		title={sound.enabled ? 'Sound on' : 'Sound off'}>{sound.enabled ? '🔊' : '🔇'}</button
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
