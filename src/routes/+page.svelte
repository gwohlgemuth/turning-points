<script lang="ts">
	import { Chess } from 'chess.js';
	import { flip } from 'svelte/animate';
	import { fade, fly, slide } from 'svelte/transition';
	import { ms } from '#lib/motion.ts';
	import Board, { type BoardMove } from '#lib/components/Board.svelte';
	import EvalBar from '#lib/components/EvalBar.svelte';
	import EvalGraph from '#lib/components/EvalGraph.svelte';
	import GameLoader from '#lib/components/GameLoader.svelte';
	import SaveFolder from '#lib/components/SaveFolder.svelte';
	import TimeChart from '#lib/components/TimeChart.svelte';
	import { describeTime } from '#lib/clock.ts';
	import Variations from '#lib/components/Variations.svelte';
	import {
		findTurningPoints,
		formatLine,
		formatScore,
		judgeMove,
		moveLabel,
		type AnalyzeEvent,
		type Move,
		type PositionEval,
		type Score,
		type Side,
		type Variation,
		winPercent
	} from '#lib/analysis.ts';
	import {
		pgnFilename,
		parseRating,
		pgnHeader,
		splitPgn,
		summaryFromPgn,
		winner,
		type GameSummary
	} from '#lib/games.ts';
	import { savePgn } from '#lib/saving.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let pgn = $state('');
	let count = $state(3);
	let side = $state<Side>('w');
	let depth = $state(16);
	let lines = $state(3);

	let status = $state<'idle' | 'running' | 'done' | 'error'>('idle');
	let message = $state('');
	let startFen = $state('');
	let moves = $state<Move[]>([]);
	let headers = $state<Record<string, string>>({});
	let evals = $state<PositionEval[]>([]);
	let selected = $state(0);
	let flipped = $state(false);
	let opened = $state<Record<number, boolean>>({});
	let loadedGames = $state<GameSummary[]>([]);
	let exploration = $state<{
		base: number;
		moves: BoardMove[];
		sans: string[];
		fens: string[];
	} | null>(null);
	let explorationEval = $state<{ score: Score; winPercent: number } | null>(null);
	let explorationPending = $state(false);
	let showEngine = $state(false);
	let play = $state(false);
	let elo = $state(1500);
	let engineThinking = $state(false);
	let engineError = $state('');
	let controller: AbortController | null = null;
	let moveController: AbortController | null = null;

	let positions = $derived(moves.length + 1);
	let winPercents = $derived.by(() => {
		const result: number[] = [];
		for (const e of evals) {
			if (!e) break;
			result.push(e.winPercent);
		}
		return result;
	});
	let turningPoints = $derived(findTurningPoints(winPercents, count, side));
	const RESULT_LABELS = { w: 'White wins', b: 'Black wins', draw: 'Draw' };
	let won = $derived(winner(headers.Result ?? '*'));
	let hasTimes = $derived(moves.some((m) => m.time));
	let turningPlies = $derived(new Set(turningPoints.map((tp) => tp.ply)));
	let fen = $derived(positionFen(selected));
	let lastMove = $derived(selected > 0 ? moves[selected - 1] : null);
	let boardFen = $derived(exploration?.fens.at(-1) ?? fen);
	let boardHighlight = $derived.by(() => {
		const move = exploration?.moves.at(-1) ?? lastMove;
		return move ? [move.from, move.to] : [];
	});
	let playing = $derived(play && !!exploration);
	let gameOver = $derived(new Chess(boardFen).isGameOver());
	let barEval = $derived(
		playing ? null : exploration ? explorationEval : (evals[selected] ?? null)
	);

	function positionFen(index: number): string {
		return index === 0 ? startFen : (moves[index - 1]?.fenAfter ?? startFen);
	}

	function pushExplorationMove(boardMove: BoardMove) {
		const chess = new Chess(boardFen);
		const move = chess.move(boardMove);
		if (!exploration) {
			exploration = { base: selected, moves: [], sans: [], fens: [] };
			explorationEval = null;
		}
		exploration.moves.push(boardMove);
		exploration.sans.push(move.san);
		exploration.fens.push(chess.fen());
		return chess;
	}

	function handleBoardMove(boardMove: BoardMove) {
		if (!exploration && !play) {
			const move = new Chess(boardFen).move(boardMove);
			if (moves[selected]?.san === move.san) {
				select(selected + 1);
				return;
			}
		}
		const chess = pushExplorationMove(boardMove);
		if (play && !chess.isGameOver()) requestEngineMove();
	}

	async function requestEngineMove() {
		moveController?.abort();
		const current = (moveController = new AbortController());
		engineThinking = true;
		engineError = '';
		try {
			const response = await fetch('/api/move', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ fen: boardFen, elo }),
				signal: current.signal
			});
			const body = await response.json();
			if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
			if (!body.uci) return;
			const uci: string = body.uci;
			pushExplorationMove({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			engineError = (err as Error).message;
		} finally {
			if (moveController === current) engineThinking = false;
		}
	}

	function cancelEngineMove() {
		moveController?.abort();
		moveController = null;
		engineThinking = false;
		engineError = '';
	}

	function popExplorationMove() {
		if (!exploration) return;
		exploration.moves.pop();
		exploration.sans.pop();
		exploration.fens.pop();
		if (!exploration.moves.length) exploration = null;
	}

	function undoExploration() {
		if (!exploration) return;
		const thinking = engineThinking;
		cancelEngineMove();
		popExplorationMove();
		if (!play || thinking || !exploration) return;
		const userSide = positionFen(exploration.base).split(' ')[1];
		if (boardFen.split(' ')[1] !== userSide) popExplorationMove();
	}

	function handleExplorationResult(variations: Variation[] | null) {
		explorationPending = !variations;
		const best = variations?.[0];
		if (!best) return;
		explorationEval = {
			score: best.score,
			winPercent: winPercent(best.score, boardFen.split(' ')[1] === 'w')
		};
	}
	let progress = $derived(positions > 0 ? Math.round((winPercents.length / positions) * 100) : 0);

	function handleEvent(event: AnalyzeEvent) {
		if (event.type === 'start') {
			startFen = event.startFen;
			moves = event.moves;
			headers = event.headers;
			evals = [];
			opened = {};
			cancelEngineMove();
			exploration = null;
			selected = 0;
		} else if (event.type === 'eval') {
			evals[event.eval.index] = event.eval;
		} else if (event.type === 'done') {
			status = 'done';
		} else {
			status = 'error';
			message = event.message;
		}
	}

	async function analyze() {
		controller?.abort();
		controller = new AbortController();
		status = 'running';
		message = '';
		try {
			const response = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pgn, depth }),
				signal: controller.signal
			});
			if (!response.ok || !response.body) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.message ?? `Request failed (${response.status})`);
			}
			const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line));
			}
			if (status === 'running') status = 'done';
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			status = 'error';
			message = (err as Error).message;
		}
	}

	function stop() {
		controller?.abort();
		status = 'done';
	}

	function select(index: number) {
		cancelEngineMove();
		exploration = null;
		selected = Math.min(positions - 1, Math.max(0, index));
	}

	function handleKey(event: KeyboardEvent) {
		if (!moves.length || (event.target as HTMLElement).tagName === 'TEXTAREA') return;
		if (exploration) {
			if (event.key === 'ArrowLeft') undoExploration();
			return;
		}
		if (event.key === 'ArrowLeft') select(selected - 1);
		if (event.key === 'ArrowRight') select(selected + 1);
	}

	function loadGame(game: GameSummary, player: Side) {
		pgn = game.pgn;
		side = player;
		flipped = player === 'b';
		analyze();
	}

	async function loadFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const text = await file.text();
		const games = splitPgn(text);
		if (games.length > 1) loadedGames = games.map(summaryFromPgn);
		else pgn = text;
	}
</script>

<svelte:window onkeydown={handleKey} />

{#snippet playControls()}
	<div class="play">
		<label class="toggle">
			<input type="checkbox" bind:checked={play} onchange={() => !play && cancelEngineMove()} />
			Play vs Stockfish
		</label>
		{#if play}
			<label class="toggle">
				Elo
				<input type="number" min="1320" max="3190" step="50" bind:value={elo} />
			</label>
		{/if}
	</div>
{/snippet}

<main>
	<header class="hero">
		<img class="logo" src="/pieces/wN.svg" alt="" />
		<div>
			<h1>Turning Points</h1>
			<p class="lead">
				Find the moments where your game turned — the moves where the evaluation swung the most.
				Study those positions first, before looking at the engine. <span class="credit"
					>Inspired by GM Noël Studer</span
				>
			</p>
		</div>
	</header>

	<div class="top">
		<section class="card load">
			<h2 class="card-title">Load a game</h2>
			<GameLoader onselect={loadGame} bind:games={loadedGames} preferences={data.preferences} />
			<textarea bind:value={pgn} rows="6" placeholder="…or paste a PGN here"></textarea>
			<div class="file-row">
				<input
					type="file"
					accept=".pgn,text/plain"
					onchange={loadFile}
					aria-label="Open PGN file"
				/>
				<button onclick={() => savePgn(pgn, pgnFilename(pgn))} disabled={!pgn.trim()}>
					Save
				</button>
			</div>
			<SaveFolder folder={data.preferences.folder} />
		</section>

		<section class="card settings">
			<h2 class="card-title">Analysis</h2>
			<div class="controls">
				<label>
					<span>Analyze for</span>
					<select bind:value={side} onchange={() => (flipped = side === 'b')}>
						<option value="w">{pgnHeader(pgn, 'White') ?? 'White'} (White)</option>
						<option value="b">{pgnHeader(pgn, 'Black') ?? 'Black'} (Black)</option>
					</select>
				</label>
				<label>
					<span>Turning points <strong class="value">{count}</strong></span>
					<input type="range" min="1" max="10" bind:value={count} />
				</label>
				<div class="pair">
					<label>
						<span>Depth</span>
						<input type="number" min="6" max="30" bind:value={depth} />
					</label>
					<label>
						<span>Engine lines</span>
						<input type="number" min="1" max="5" bind:value={lines} />
					</label>
				</div>
			</div>
			{#if status === 'running'}
				<button class="analyze" onclick={stop}>Stop</button>
				<div class="progress" role="progressbar" aria-valuenow={progress}>
					<div class="progress-fill" style:width="{progress}%"></div>
				</div>
				<span class="muted small">Analyzing… {winPercents.length}/{positions} positions</span>
			{:else}
				<button class="primary analyze" onclick={analyze} disabled={!pgn.trim()}
					>Analyze game</button
				>
			{/if}
			{#if status === 'error'}
				<p class="error">{message}</p>
			{/if}
		</section>
	</div>

	{#if moves.length}
		<div class="results" in:fade={{ duration: ms(300) }}>
			<section class="card graphs">
				<div class="players">
					<span class="player white" class:winner={won === 'w'} class:loser={won === 'b'}>
						{headers.White ?? 'White'}
						{#if parseRating(headers.WhiteElo)}
							<span class="rating">{parseRating(headers.WhiteElo)}</span>
						{/if}
						{#if won === 'w'}<span class="crown" title="Winner">♚</span>{/if}
					</span>
					<span class="result {won ?? ''}">{won ? RESULT_LABELS[won] : 'No result'}</span>
					<span class="player black" class:winner={won === 'b'} class:loser={won === 'w'}>
						{headers.Black ?? 'Black'}
						{#if parseRating(headers.BlackElo)}
							<span class="rating">{parseRating(headers.BlackElo)}</span>
						{/if}
						{#if won === 'b'}<span class="crown" title="Winner">♚</span>{/if}
					</span>
				</div>
				<EvalGraph
					{winPercents}
					{positions}
					{moves}
					{evals}
					{turningPoints}
					{selected}
					onselect={select}
				/>
				{#if hasTimes}
					<TimeChart {moves} {turningPlies} {selected} onselect={select} />
				{/if}
			</section>

			<div class="layout">
				<section class="card board-panel">
					<div class="board-row">
						<EvalBar
							score={barEval?.score ?? null}
							winPercent={barEval?.winPercent ?? 50}
							{flipped}
						/>
						<Board
							fen={boardFen}
							{flipped}
							highlight={boardHighlight}
							onmove={engineThinking ? undefined : handleBoardMove}
						/>
					</div>
					<div class="nav">
						<button onclick={() => select(0)} aria-label="Start">⏮</button>
						<button onclick={() => select(selected - 1)} aria-label="Previous">◀</button>
						<button onclick={() => select(selected + 1)} aria-label="Next">▶</button>
						<button onclick={() => select(positions - 1)} aria-label="End">⏭</button>
						<button class="flip" onclick={() => (flipped = !flipped)}>⇅ Flip</button>
					</div>
					{#if exploration}
						<div class="exploration" transition:slide={{ duration: ms(200) }}>
							<div class="exploration-head">
								<span class="tag">Your line</span>
								<span class="score">
									{#if playing}
										<span class="muted">
											{#if gameOver}Game over{:else if engineThinking}Stockfish is thinking…{:else}Playing
												vs Stockfish · Elo {elo}{/if}
										</span>
									{:else if explorationPending || !explorationEval}
										<span class="muted">Calculating…</span>
									{:else}
										{formatScore(explorationEval.score)}
									{/if}
								</span>
							</div>
							<div class="line">{formatLine(positionFen(exploration.base), exploration.sans)}</div>
							{#if engineError}<p class="error">{engineError}</p>{/if}
							<div class="nav">
								<button onclick={undoExploration}>Undo move</button>
								<button onclick={() => select(exploration!.base)}>Back to game</button>
							</div>
							{@render playControls()}
							{#if !playing}
								<details bind:open={showEngine}>
									<summary>Engine lines</summary>
									<Variations fen={boardFen} {depth} {lines} onresult={handleExplorationResult} />
								</details>
							{/if}
						</div>
					{:else}
						<p class="position">
							<strong>{lastMove ? moveLabel(lastMove.ply, lastMove.san) : 'Start position'}</strong>
							{#if evals[selected]}<span class="pill">{formatScore(evals[selected].score)}</span
								>{/if}
							<span class="muted small"
								>{play ? 'Make a move to start playing' : 'Move a piece to try your own line'}</span
							>
						</p>
						{@render playControls()}
						<details class="engine" bind:open={showEngine}>
							<summary>Engine lines</summary>
							{#if showEngine}
								<Variations {fen} {depth} {lines} />
							{/if}
						</details>
					{/if}
				</section>

				<section class="card points">
					<h2 class="card-title">Turning points</h2>
					{#if !turningPoints.length}
						<p class="muted">Waiting for the engine…</p>
					{/if}
					<ol>
						{#each turningPoints as tp, i (tp.ply)}
							{@const move = moves[tp.ply - 1]}
							{@const before = evals[tp.ply - 1]}
							{@const after = evals[tp.ply]}
							{@const judgement = judgeMove(tp.delta)}
							<li
								class="tp {judgement?.name ?? ''}"
								class:active={selected === tp.ply - 1 || selected === tp.ply}
								animate:flip={{ duration: ms(250) }}
								in:fly={{ y: 16, duration: ms(300), delay: ms(i * 70) }}
							>
								<div class="tp-head">
									<button class="link" onclick={() => select(tp.ply - 1)}>
										{moveLabel(tp.ply, move.san)}{#if judgement}<span
												class="judgement {judgement.name}"
												title={judgement.name}>{judgement.symbol}</span
											>{/if}
									</button>
									<span
										class="evals"
										title="Winning chances {tp.delta > 0 ? '+' : ''}{tp.delta.toFixed(1)}%"
									>
										{formatScore(before.score)} → {formatScore(after.score)}
									</span>
								</div>
								{#if move.time}
									<div class="time">⏱ {describeTime(move.time)}</div>
								{/if}
								<div class="tp-actions">
									<button onclick={() => select(tp.ply - 1)}>Position before</button>
									<button onclick={() => select(tp.ply)}>After</button>
								</div>
								<details bind:open={opened[tp.ply]}>
									<summary>Engine suggestion</summary>
									{#if opened[tp.ply]}
										<Variations fen={move.fenBefore} {depth} {lines} />
									{/if}
								</details>
							</li>
						{/each}
					</ol>

					<h2 class="card-title">Moves</h2>
					<div class="moves">
						{#each moves as move (move.ply)}
							<button
								class="move"
								class:current={selected === move.ply}
								class:turning={turningPlies.has(move.ply)}
								onclick={() => select(move.ply)}
								title={move.time ? describeTime(move.time) : undefined}
							>
								{#if move.ply % 2 === 1}<span class="num">{(move.ply + 1) / 2}.</span
									>{/if}{move.san}
							</button>
						{/each}
					</div>
				</section>
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 36px 20px 80px;
		display: grid;
		gap: 22px;
	}

	.hero {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-bottom: 6px;
	}

	.logo {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		padding: 8px;
		border-radius: 18px;
		background: radial-gradient(circle at 30% 25%, #3a3220, #191c24 70%);
		border: 1px solid rgb(227 179 65 / 0.35);
		box-shadow:
			0 0 0 6px rgb(227 179 65 / 0.06),
			0 10px 30px rgb(227 179 65 / 0.18);
		box-sizing: border-box;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.9rem, 3vw, 2.5rem);
		font-weight: 750;
		letter-spacing: -0.02em;
		width: fit-content;
		background: linear-gradient(90deg, #fff 0%, var(--accent-2) 55%, var(--accent) 100%);
		background-clip: text;
		color: transparent;
	}

	.lead {
		color: var(--muted);
		margin: 6px 0 0;
		max-width: 70ch;
		line-height: 1.5;
	}

	.credit {
		color: var(--accent);
		white-space: nowrap;
	}

	.top {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
		gap: 22px;
		align-items: start;
	}

	.load,
	.settings {
		display: grid;
		gap: 12px;
	}

	.load .card-title,
	.settings .card-title,
	.points .card-title {
		margin-bottom: 2px;
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		font-family: ui-monospace, 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.file-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		justify-content: space-between;
	}

	.controls {
		display: grid;
		gap: 14px;
	}

	.controls label {
		display: grid;
		gap: 6px;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.controls .value {
		color: var(--accent);
		margin-left: 4px;
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.pair input {
		width: 100%;
		box-sizing: border-box;
	}

	.analyze {
		width: 100%;
		padding: 11px;
		font-size: 1rem;
	}

	.small {
		font-size: 0.85rem;
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
		margin: 0;
	}

	.progress {
		height: 6px;
		border-radius: 3px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--accent) 0%, #fff3cf 50%, var(--accent) 100%);
		background-size: 200% 100%;
		animation: shimmer 1.4s linear infinite;
		transition: width 0.3s ease;
	}

	@keyframes shimmer {
		from {
			background-position: 200% 0;
		}
	}

	.results {
		display: grid;
		gap: 22px;
	}

	.graphs {
		display: grid;
		gap: 12px;
	}

	.players {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 14px;
		font-weight: 650;
		font-size: 1.05rem;
	}

	.player {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.player::before {
		content: '';
		width: 11px;
		height: 11px;
		border-radius: 3px;
		border: 1px solid var(--border-strong);
	}

	.player.white::before {
		background: #f2efe8;
	}

	.player.black::before {
		background: #0b0d11;
	}

	.player.black {
		flex-direction: row-reverse;
	}

	.player.loser {
		opacity: 0.5;
	}

	.rating {
		color: var(--muted);
		font-weight: 400;
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.crown {
		color: var(--accent);
		font-size: 1.2rem;
		line-height: 1;
	}

	.result {
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--surface-3);
		border: 1px solid var(--border-strong);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.result.w,
	.result.b {
		color: var(--accent-2);
		border-color: rgb(227 179 65 / 0.4);
		background: rgb(227 179 65 / 0.1);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 560px) minmax(0, 1fr);
		gap: 22px;
		align-items: start;
	}

	@media (max-width: 900px) {
		.top,
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.board-row {
		display: flex;
		gap: 8px;
		max-width: 520px;
	}

	.nav {
		display: flex;
		gap: 6px;
		margin-top: 12px;
	}

	.nav button {
		min-width: 42px;
	}

	.nav .flip {
		margin-left: auto;
	}

	.position {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		margin: 12px 0 0;
	}

	.engine {
		margin-top: 10px;
	}

	.play {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		margin-top: 10px;
	}

	.exploration .play {
		margin-top: 0;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
	}

	.toggle input[type='number'] {
		width: 6em;
	}

	.pill {
		padding: 2px 9px;
		border-radius: 999px;
		background: var(--surface-3);
		border: 1px solid var(--border-strong);
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}

	.exploration {
		display: grid;
		gap: 8px;
		margin-top: 14px;
		padding: 12px 14px;
		border: 1px solid rgb(227 179 65 / 0.45);
		border-radius: 12px;
		background: linear-gradient(180deg, rgb(227 179 65 / 0.08), rgb(227 179 65 / 0.02));
	}

	.exploration-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tag {
		font-size: 0.72rem;
		font-weight: 650;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.exploration .score {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.exploration .line {
		font-weight: 550;
	}

	.exploration .nav {
		margin-top: 0;
	}

	ol {
		padding: 0;
		margin: 0 0 22px;
		list-style: none;
		display: grid;
		gap: 10px;
	}

	.tp {
		position: relative;
		padding: 12px 14px 12px 18px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface-2);
		overflow: hidden;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease;
	}

	.tp::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background: var(--surface-3);
	}

	.tp.inaccuracy::before {
		background: #56b4e9;
	}

	.tp.mistake::before {
		background: #e69f00;
	}

	.tp.blunder::before {
		background: #df5353;
	}

	.tp:hover {
		background: #1f2531;
	}

	.tp.active {
		border-color: rgb(227 179 65 / 0.5);
		box-shadow: 0 0 0 3px rgb(227 179 65 / 0.12);
	}

	.tp-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--text);
		cursor: pointer;
	}

	.link:not(:disabled):hover {
		background: none;
		color: var(--accent-2);
	}

	.time {
		color: var(--muted);
		font-size: 0.85rem;
		margin-top: 4px;
	}

	.evals {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}

	.judgement.inaccuracy {
		color: #56b4e9;
	}

	.judgement.mistake {
		color: #e69f00;
	}

	.judgement.blunder {
		color: #df5353;
		display: inline-block;
		animation: pulse 0.6s ease-out 0.4s 2;
	}

	@keyframes pulse {
		50% {
			transform: scale(1.4);
		}
	}

	.tp-actions {
		display: flex;
		gap: 6px;
		margin: 10px 0 8px;
	}

	.tp-actions button {
		padding: 5px 10px;
		font-size: 0.85rem;
	}

	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.move {
		padding: 3px 8px;
		font-size: 0.85rem;
		background: transparent;
		border-color: var(--border);
		border-radius: 7px;
	}

	.move .num {
		color: var(--muted);
		margin-right: 3px;
	}

	.move.turning {
		border-color: rgb(240 106 106 / 0.6);
		color: #ff9a9a;
	}

	.move.current {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
		font-weight: 650;
	}

	.move.current .num {
		color: var(--accent-ink);
	}
</style>
