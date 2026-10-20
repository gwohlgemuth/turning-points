<script lang="ts">
	import { Chess } from 'chess.js';
	import {
		formatScore,
		formatLine,
		foundBetterMove,
		isOnlyMove,
		judgeMove,
		winPercent,
		type Move,
		type PositionEval,
		type Score,
		type Side,
		type Variation
	} from '#lib/analysis.ts';
	import backend from '#backend';
	import { fetchScore } from '#lib/lines.ts';
	import type { Verdict } from '#lib/notes.ts';

	type Props = {
		move: Move;
		candidate?: string;
		before: PositionEval;
		after: PositionEval;
		depth: number;
		side: Side;
		verdict?: Verdict;
		onverdict?: (found: boolean, best: string | null, line: string[]) => void;
	};
	type Result = { san: string; score: Score; winPercent: number };

	let {
		move,
		candidate = '',
		before,
		after,
		depth,
		side,
		verdict = '',
		onverdict
	}: Props = $props();

	let best = $state<string | null>(null);
	let onlyMove = $state(false);
	let yours = $state<Result | null>(null);
	let refutation = $state('');
	let message = $state('');

	let sign = $derived(side === 'w' ? 1 : -1);
	let judgement = $derived(judgeMove(sign * (after.winPercent - before.winPercent)));
	let found = $derived(
		yours ? yours.san === best || foundBetterMove(before.winPercent, yours.winPercent, side) : false
	);

	$effect(() => {
		const controller = new AbortController();
		best = null;
		onlyMove = false;
		yours = null;
		refutation = '';
		message = '';
		if (judgement && !new Chess(move.fenAfter).isGameOver()) {
			backend
				.lines(move.fenAfter, depth, 1, controller.signal)
				.then(([line]) => {
					if (line?.moves.length) refutation = formatLine(move.fenAfter, line.moves.slice(0, 3));
				})
				.catch(() => {});
		}
		const bestLines = backend.lines(move.fenBefore, depth, 2, controller.signal);
		const showBest = (variations: Variation[]) => {
			best = variations[0]?.moves[0] ?? null;
			onlyMove = isOnlyMove(variations, side);
		};
		const fail = (err: Error) => {
			if (err.name !== 'AbortError') message = err.message;
		};
		if (!candidate) {
			bestLines.then(showBest).catch(fail);
			return () => controller.abort();
		}
		const chess = new Chess(move.fenBefore);
		let fen: string;
		let san: string;
		try {
			san = chess.move(candidate).san;
			fen = chess.fen();
		} catch {
			message = `${candidate} is not a legal move here`;
			return () => controller.abort();
		}
		const whiteToMove = fen.split(' ')[1] === 'w';
		Promise.all([bestLines, fetchScore(fen, depth, controller.signal)])
			.then(([variations, score]) => {
				showBest(variations);
				yours = { san, score, winPercent: winPercent(score, whiteToMove) };
				onverdict?.(found, best, variations[0]?.moves ?? []);
			})
			.catch(fail);
		return () => controller.abort();
	});
</script>

<div class="check">
	<span class="label">Game move</span>
	<span class="san">{move.san}{judgement?.symbol ?? ''}</span>
	<span class="score">{formatScore(after.score)}</span>
	<span></span>

	{#if refutation}
		<span class="label">Refutation</span>
		<span class="san line">{refutation}</span>
	{/if}

	{#if candidate}
		<span class="label">Your move</span>
		<span class="san">{candidate}</span>
		{#if message}
			<span class="error wide">{message}</span>
		{:else if !yours}
			<span class="muted wide">Calculating…</span>
		{:else}
			<span class="score">{formatScore(yours.score)}</span>
			{@const shown = verdict ? verdict === 'found' : found}
			<span class="verdict" class:found={shown}>{shown ? '✓ found' : '✗ missed'}</span>
		{/if}
	{:else if message}
		<span class="error full">{message}</span>
	{/if}

	<span class="label">Engine</span>
	<span class="san">{best ?? '…'}</span>
	<span class="score">{formatScore(before.score)}</span>
	{#if onlyMove}
		<span class="only" title="Every other move gives away at least 10% winning chances"
			>only move</span
		>
	{:else}
		<span></span>
	{/if}
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

	.only {
		justify-self: start;
		color: var(--accent-2);
	}

	.full {
		grid-column: 1 / -1;
	}

	.wide {
		grid-column: span 2;
	}

	.line {
		grid-column: span 3;
		font-weight: 500;
	}

	.verdict {
		justify-self: start;
		display: inline-block;
		color: var(--danger);
		animation: shake 0.45s ease-in-out;
	}

	.verdict.found {
		color: #6fcf7f;
		animation:
			pop 0.45s cubic-bezier(0.3, 1.6, 0.5, 1),
			glow 1.2s ease-out;
	}

	@keyframes shake {
		20%,
		60% {
			transform: translateX(-4px);
		}
		40%,
		80% {
			transform: translateX(4px);
		}
	}

	@keyframes pop {
		from {
			transform: scale(0.3);
			opacity: 0;
		}
	}

	@keyframes glow {
		from {
			text-shadow: 0 0 14px rgb(111 207 127 / 0.9);
		}
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}
</style>
