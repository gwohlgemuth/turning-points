<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import { Chess } from 'chess.js';
	import {
		moveSquares,
		winPercent,
		type Arrow,
		type Move,
		type PositionEval
	} from '#lib/analysis.ts';
	import Board, { type BoardMove } from '#lib/components/Board.svelte';
	import CandidateCheck from '#lib/components/CandidateCheck.svelte';
	import CountUp from '#lib/components/CountUp.svelte';
	import { fetchScore } from '#lib/lines.ts';
	import { addDays, localDay, REVIEW_DEPTH } from '#lib/review.ts';
	import { playFound, playMissed } from '#lib/sound.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let index = $state(0);
	let candidate = $state<{ san: string; fen: string; from: string; to: string } | null>(null);
	let evals = $state<{ before: PositionEval; after: PositionEval } | null>(null);
	let recorded = $state(false);
	let best = $state<string | null>(null);
	let message = $state('');
	let found = $state(0);
	let missed = $state(0);
	let streak = $state(0);
	let longestStreak = $state(0);
	let scheduled = $state<string[]>([]);

	let card = $derived(data.due[index] ?? null);
	let nextReview = $derived.by(() => {
		const days = [...data.upcoming, ...scheduled];
		if (!days.length) return null;
		const day = days.reduce((a, b) => (a < b ? a : b));
		return { day, count: days.filter((other) => other === day).length };
	});
	let move = $derived.by((): Move | null => {
		if (!card) return null;
		const played = new Chess(card.fen).move(card.move);
		return {
			ply: card.ply,
			san: played.san,
			from: played.from,
			to: played.to,
			fenBefore: card.fen,
			fenAfter: played.after,
			time: null
		};
	});

	const toEval = (fen: string, score: PositionEval['score']): PositionEval => ({
		index: 0,
		score,
		winPercent: winPercent(score, fen.split(' ')[1] === 'w')
	});
	const formatDate = (date: number) => (date ? new Date(date).toISOString().slice(0, 10) : '?');

	$effect(() => {
		if (!move) return;
		const { fenBefore, fenAfter } = move;
		const controller = new AbortController();
		evals = null;
		message = '';
		Promise.all([
			fetchScore(fenBefore, REVIEW_DEPTH, controller.signal),
			fetchScore(fenAfter, REVIEW_DEPTH, controller.signal)
		])
			.then(([before, after]) => {
				evals = { before: toEval(fenBefore, before), after: toEval(fenAfter, after) };
			})
			.catch((err: Error) => {
				if (err.name !== 'AbortError') message = err.message;
			});
		return () => controller.abort();
	});

	function handleMove(boardMove: BoardMove) {
		if (!card || candidate) return;
		const chess = new Chess(card.fen);
		const played = chess.move(boardMove);
		candidate = { san: played.san, fen: chess.fen(), from: played.from, to: played.to };
	}

	let arrows = $derived.by((): Arrow[] => {
		if (!card || !candidate || !recorded) return [];
		const result: Arrow[] = [];
		const add = (san: string | null, kind: Arrow['kind']) => {
			const squares = san ? moveSquares(card.fen, san) : null;
			if (squares) result.push({ ...squares, kind });
		};
		add(card.move, 'game');
		add(candidate.san, 'candidate');
		add(best, 'best');
		return result;
	});

	async function record(result: boolean, bestMove: string | null) {
		if (!card || recorded) return;
		recorded = true;
		best = bestMove;
		if (result) found++;
		else missed++;
		(result ? playFound : playMissed)();
		streak = result ? streak + 1 : 0;
		longestStreak = Math.max(longestStreak, streak);
		const response = await fetch('/api/review', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: card.key, found: result })
		}).catch(() => null);
		if (!response?.ok) {
			message = 'Could not save the review';
			return;
		}
		const state = await response.json();
		if (state.due) scheduled.push(state.due);
	}

	function when(day: string) {
		const today = localDay();
		if (day === addDays(today, 1)) return 'tomorrow';
		const days = Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000);
		return `in ${days} days`;
	}

	function next() {
		index++;
		candidate = null;
		recorded = false;
		best = null;
	}
</script>

<svelte:head>
	<title>Review · Turning Points</title>
</svelte:head>

<main>
	<Header />

	<div class="page-head">
		<h1>Review</h1>
		<p class="muted small">
			Missed turning points from ~/{data.folder} · {Math.max(data.due.length - index, 0)} due today ·
			{data.upcoming.length} upcoming · {data.learned} learned
		</p>
	</div>

	{#if !data.due.length}
		<section class="card">
			<p class="muted">
				Nothing to review today. Turning points you missed in the analysis appear here the day after
				you saved your notes, and come back after 1, 3, 7, 14 and 30 days until you find them.
			</p>
		</section>
	{:else if !card || !move}
		<section class="card done">
			{#if found}
				<div class="burst" aria-hidden="true">
					{#each { length: 14 }, i (i)}
						<span style:--angle="{i * (360 / 14)}deg"></span>
					{/each}
				</div>
			{/if}
			<h2 class="card-title">All done for today</h2>
			<p class="result">
				<span class="found">✓ <CountUp value={found} /> found</span> ·
				<span class="missed">✗ <CountUp value={missed} /> missed</span>
			</p>
			{#if longestStreak > 1}
				<p class="muted">Longest streak: {longestStreak} in a row</p>
			{/if}
			{#if nextReview}
				<p class="muted small">
					Next: {nextReview.count}
					{nextReview.count === 1 ? 'card' : 'cards'}
					{when(nextReview.day)}
				</p>
			{/if}
		</section>
	{:else}
		<section class="card trainer">
			<div class="board">
				<Board
					fen={arrows.length ? card.fen : (candidate?.fen ?? card.fen)}
					flipped={card.side === 'b'}
					highlight={candidate && !arrows.length ? [candidate.from, candidate.to] : []}
					{arrows}
					onmove={candidate ? undefined : handleMove}
				/>
			</div>
			<div class="info">
				<h2 class="card-title">
					Card {index + 1} of {data.due.length}
					{#if streak > 1}
						{#key streak}
							<span class="streak">🔥 {streak} in a row</span>
						{/key}
					{/if}
				</h2>
				<p>
					<strong>{card.white} – {card.black}</strong>
					<span class="muted small">{formatDate(card.date)}</span>
				</p>
				<p class="muted">
					{card.side === 'w' ? 'White' : 'Black'} to move (move {Math.ceil(card.ply / 2)}). You
					missed this turning point before. Play the move you would choose now.
				</p>
				{#if message}
					<p class="error">{message}</p>
				{/if}
				{#if candidate}
					{#if evals}
						<CandidateCheck
							{move}
							candidate={candidate.san}
							before={evals.before}
							after={evals.after}
							depth={REVIEW_DEPTH}
							side={card.side}
							onverdict={record}
						/>
					{:else}
						<p class="muted">Calculating…</p>
					{/if}
					{#if recorded && card.lesson}
						<p class="lesson"><span class="muted small">Your rule</span> {card.lesson}</p>
					{/if}
					<button class="primary" onclick={next} disabled={!recorded}>Next</button>
				{/if}
			</div>
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 16px 20px 80px;
		display: grid;
		gap: 22px;
	}

	.page-head h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
	}

	.page-head p {
		margin: 2px 0 0;
	}

	.trainer {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: flex-start;
	}

	.board {
		display: flex;
		width: min(520px, 100%);
	}

	.info {
		flex: 1;
		min-width: 260px;
	}

	.found {
		color: var(--good);
	}

	.streak {
		display: inline-block;
		margin-left: 10px;
		color: var(--accent-2);
		letter-spacing: normal;
		text-transform: none;
		animation: bump 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
	}

	@keyframes bump {
		from {
			transform: scale(0.5);
			opacity: 0;
		}
	}

	.done {
		position: relative;
		overflow: hidden;
		text-align: center;
	}

	.result {
		font-size: 1.6rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.burst span {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--accent);
		opacity: 0;
		animation: fly 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s;
	}

	.burst span:nth-child(3n) {
		background: var(--good);
	}

	.burst span:nth-child(3n + 1) {
		background: var(--accent-2);
	}

	@keyframes fly {
		from {
			opacity: 1;
			transform: rotate(var(--angle)) translateY(0);
		}
		to {
			opacity: 0;
			transform: rotate(var(--angle)) translateY(-140px) rotate(180deg);
		}
	}

	.missed,
	.lesson {
		display: grid;
		gap: 2px;
		padding-left: 10px;
		border-left: 2px solid var(--accent);
	}

	.error {
		color: var(--danger);
	}

	.muted {
		color: var(--muted);
	}

	.small {
		font-size: 0.85rem;
	}
</style>
