<script lang="ts">
	import { Chess } from 'chess.js';
	import {
		formatScore,
		foundBetterMove,
		judgeMove,
		winPercent,
		type Move,
		type PositionEval,
		type Score,
		type Side
	} from '#lib/analysis.ts';
	import { fetchLines } from '#lib/lines.ts';

	type Props = {
		move: Move;
		candidate: string;
		before: PositionEval;
		after: PositionEval;
		depth: number;
		side: Side;
		onverdict?: (found: boolean) => void;
	};
	type Result = { san: string; score: Score; winPercent: number };

	let { move, candidate, before, after, depth, side, onverdict }: Props = $props();

	let best = $state<string | null>(null);
	let yours = $state<Result | null>(null);
	let message = $state('');

	let sign = $derived(side === 'w' ? 1 : -1);
	let judgement = $derived(judgeMove(sign * (after.winPercent - before.winPercent)));
	let found = $derived(
		yours ? yours.san === best || foundBetterMove(before.winPercent, yours.winPercent, side) : false
	);

	async function evaluate(fen: string, signal: AbortSignal): Promise<Score> {
		const chess = new Chess(fen);
		if (chess.isCheckmate()) return { type: 'mate', value: 0 };
		if (chess.isGameOver()) return { type: 'cp', value: 0 };
		const [line] = await fetchLines(fen, depth, 1, signal);
		return line.score;
	}

	$effect(() => {
		const controller = new AbortController();
		best = null;
		yours = null;
		message = '';
		const chess = new Chess(move.fenBefore);
		let fen: string;
		let san: string;
		try {
			san = chess.move(candidate).san;
			fen = chess.fen();
		} catch {
			message = `${candidate} is not a legal move here`;
			return;
		}
		const whiteToMove = fen.split(' ')[1] === 'w';
		Promise.all([
			fetchLines(move.fenBefore, depth, 1, controller.signal),
			evaluate(fen, controller.signal)
		])
			.then(([[line], score]) => {
				best = line?.moves[0] ?? null;
				yours = { san, score, winPercent: winPercent(score, whiteToMove) };
				onverdict?.(found);
			})
			.catch((err: Error) => {
				if (err.name !== 'AbortError') message = err.message;
			});
		return () => controller.abort();
	});
</script>

<div class="check">
	<span class="label">Game move</span>
	<span class="san">{move.san}{judgement?.symbol ?? ''}</span>
	<span class="score">{formatScore(after.score)}</span>
	<span></span>

	<span class="label">Your move</span>
	<span class="san">{candidate}</span>
	{#if message}
		<span class="error wide">{message}</span>
	{:else if !yours}
		<span class="muted wide">Calculating…</span>
	{:else}
		<span class="score">{formatScore(yours.score)}</span>
		<span class="verdict" class:found>{found ? '✓ found' : '✗ missed'}</span>
	{/if}

	<span class="label">Engine</span>
	<span class="san">{best ?? '…'}</span>
	<span class="score">{formatScore(before.score)}</span>
	<span></span>
</div>

<style>
	.check {
		display: grid;
		grid-template-columns: auto auto auto 1fr;
		gap: 4px 14px;
		align-items: baseline;
		margin: 10px 0 2px;
		font-size: 0.9rem;
	}

	.label {
		color: var(--muted);
	}

	.san {
		font-weight: 650;
	}

	.score {
		font-variant-numeric: tabular-nums;
	}

	.wide {
		grid-column: span 2;
	}

	.verdict {
		color: var(--danger);
	}

	.verdict.found {
		color: #6fcf7f;
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}
</style>
