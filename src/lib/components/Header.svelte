<script lang="ts">
	import type { Snippet } from 'svelte';
	import Nav from '#lib/components/Nav.svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<header>
	<a class="brand" href="/" aria-label="Turning Points – Analysis">
		<img class="logo" src="/logo.svg" alt="" />
		<span class="name">
			<span class="wordmark">Turning Points</span>
			<span class="credit">Inspired by GM Noël Studer</span>
		</span>
	</a>
	{@render children?.()}
	<Nav />
</header>

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 12px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 46px;
		margin-right: auto;
		text-decoration: none;
		view-transition-name: brand;
	}

	.logo {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		padding: 5px;
		border-radius: 12px;
		background: radial-gradient(circle at 30% 25%, #3a3220, #191c24 70%);
		border: 1px solid rgb(227 179 65 / 0.35);
		box-sizing: border-box;
		transition: border-color 150ms ease;
	}

	.brand:hover .logo {
		border-color: var(--accent);
	}

	.name {
		display: grid;
	}

	.wordmark {
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
		line-height: 1.2;
		width: fit-content;
		background: linear-gradient(90deg, #fff 0%, var(--accent-2) 55%, var(--accent) 100%);
		background-clip: text;
		color: transparent;
	}

	.credit {
		margin-top: 2px;
		font-size: 0.8rem;
		color: var(--accent);
		white-space: nowrap;
	}
</style>
