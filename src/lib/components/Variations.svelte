<script lang="ts">
	import { formatLine, formatScore, type Variation } from '#lib/analysis.ts';
	import backend from '#backend';

	type Props = {
		fen: string;
		depth: number;
		lines: number;
		onresult?: (variations: Variation[] | null) => void;
	};

	let { fen, depth, lines, onresult }: Props = $props();

	let variations = $state<Variation[] | null>(null);
	let message = $state('');

	$effect(() => {
		const controller = new AbortController();
		variations = null;
		message = '';
		onresult?.(null);
		backend
			.lines(fen, depth, lines, controller.signal)
			.then((result) => {
				variations = result;
				onresult?.(result);
			})
			.catch((err: Error) => {
				if (err.name !== 'AbortError') message = err.message;
			});
		return () => controller.abort();
	});
</script>

{#if message}
	<p class="error">{message}</p>
{:else if !variations}
	<p class="muted">Calculating…</p>
{:else}
	<ol>
		{#each variations as variation, i (i)}
			<li>
				<span class="score" class:black={variation.score.value < 0}>
					{formatScore(variation.score)}
				</span>
				<span class="line">{formatLine(fen, variation.moves)}</span>
			</li>
		{/each}
	</ol>
{/if}

<style>
	ol {
		list-style: none;
		padding: 0;
		margin: 8px 0 0;
		display: grid;
		gap: 6px;
	}

	li {
		display: flex;
		gap: 8px;
		align-items: baseline;
		font-size: 0.9rem;
	}

	.score {
		flex-shrink: 0;
		min-width: 4.2em;
		text-align: center;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 4px;
		background: #ece9e3;
		color: #1b1d22;
		border: 1px solid transparent;
		font-variant-numeric: tabular-nums;
	}

	.score.black {
		background: #0b0d11;
		color: #ece9e3;
		border-color: var(--border-strong);
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}
</style>
