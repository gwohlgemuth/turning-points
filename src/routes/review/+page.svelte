<script lang="ts">
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
	import { fetchScore } from '#lib/lines.ts';
	import { REVIEW_DEPTH } from '#lib/review.ts';
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

	let card = $derived(data.due[index] ?? null);
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
		const response = await fetch('/api/review', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: card.key, found: result })
		}).catch(() => null);
		if (!response?.ok) message = 'Could not save the review';
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
	<header>
		<img class="logo" src="/pieces/wN.svg" alt="" />
		<div>
			<h1>Review</h1>
			<p class="muted small">
				Missed turning points from ~/{data.folder} · {Math.max(data.due.length - index, 0)} due today
				· {data.upcoming} upcoming · {data.learned} learned
			</p>
		</div>
		<a class="back" href="/stats">Stats</a>
		<a class="back" href="/">← Back to analysis</a>
	</header>

	{#if !data.due.length}
		<section class="card">
			<p class="muted">
				Nothing to review today. Turning points you missed in the analysis appear here once you
				saved your notes, and come back after 1, 3, 7, 14 and 30 days until you find them.
			</p>
		</section>
	{:else if !card || !move}
		<section class="card">
			<h2 class="card-title">All done for today</h2>
			<p>
				<span class="found">✓ {found} found</span> · <span class="missed">✗ {missed} missed</span>
			</p>
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
				<h2 class="card-title">Card {index + 1} of {data.due.length}</h2>
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

	header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo {
		width: 40px;
		height: 40px;
		padding: 5px;
		border-radius: 12px;
		background: radial-gradient(circle at 30% 25%, #3a3220, #191c24 70%);
		border: 1px solid rgb(227 179 65 / 0.35);
		box-sizing: border-box;
	}

	h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
		width: fit-content;
		background: linear-gradient(90deg, #fff 0%, var(--accent-2) 55%, var(--accent) 100%);
		background-clip: text;
		color: transparent;
	}

	header p {
		margin: 2px 0 0;
	}

	.back {
		color: var(--accent-2);
		text-decoration: none;
	}

	.back:first-of-type {
		margin-left: auto;
	}

	.back:hover {
		text-decoration: underline;
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

	.missed,
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
