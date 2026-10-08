<script lang="ts">
	import type { Score } from '#lib/analysis.ts';

	type Props = { score: Score | null; winPercent: number; flipped?: boolean; hidden?: boolean };

	let { score, winPercent, flipped = false, hidden = false }: Props = $props();

	let whiteAhead = $derived(winPercent >= 50);
	let label = $derived.by(() => {
		if (!score) return '';
		if (score.type === 'mate') return score.value === 0 ? '#' : `M${Math.abs(score.value)}`;
		return (Math.abs(score.value) / 100).toFixed(1);
	});
</script>

{#if hidden}
	<div class="bar hidden" title="Evaluation hidden until you reveal">
		<span class="label">?</span>
	</div>
{:else}
	<div class="bar" class:flipped title="Evaluation">
		<div class="white" style:height="{winPercent}%"></div>
		<span class="label" class:on-white={whiteAhead}>{label}</span>
	</div>
{/if}

<style>
	.bar {
		position: relative;
		width: 26px;
		flex-shrink: 0;
		background: #2b2925;
		border-radius: 8px;
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.4),
			0 16px 40px rgb(0 0 0 / 0.45);
		overflow: hidden;
		display: flex;
		flex-direction: column-reverse;
	}

	.bar.flipped {
		flex-direction: column;
	}

	.bar.hidden {
		justify-content: center;
		background: repeating-linear-gradient(-45deg, #4a4741 0 6px, #3a3833 6px 12px);
	}

	.hidden .label {
		position: static;
		font-size: 14px;
		color: #b5b0a8;
	}

	.white {
		background: #f2f2f2;
		transition: height 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.label {
		position: absolute;
		left: 0;
		right: 0;
		top: 4px;
		text-align: center;
		font-size: 10px;
		font-weight: 700;
		color: #f2f2f2;
	}

	.label.on-white {
		top: auto;
		bottom: 4px;
		color: #403d39;
	}

	.flipped .label {
		top: auto;
		bottom: 4px;
	}

	.flipped .label.on-white {
		top: 4px;
		bottom: auto;
	}
</style>
