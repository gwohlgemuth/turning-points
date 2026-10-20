<script lang="ts">
	import { resolve } from '$app/paths';
	import { Chess } from 'chess.js';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fade, fly, slide } from 'svelte/transition';
	import backend from '#backend';
	import { ms } from '#lib/motion.ts';
	import Board, { type BoardMove } from '#lib/components/Board.svelte';
	import EvalBar from '#lib/components/EvalBar.svelte';
	import EvalGraph from '#lib/components/EvalGraph.svelte';
	import GameLoader from '#lib/components/GameLoader.svelte';
	import Header from '#lib/components/Header.svelte';
	import SaveFolder from '#lib/components/SaveFolder.svelte';
	import TimeChart from '#lib/components/TimeChart.svelte';
	import { describeTime, formatDuration } from '#lib/clock.ts';
	import Variations from '#lib/components/Variations.svelte';
	import CandidateCheck from '#lib/components/CandidateCheck.svelte';
	import CountUp from '#lib/components/CountUp.svelte';
	import {
		findTurningPoints,
		formatLine,
		formatScore,
		judgeMove,
		moveLabel,
		moveSquares,
		uciSquares,
		type AnalyzeEvent,
		type Arrow,
		type Move,
		type PositionEval,
		type Score,
		type Side,
		MIN_SWING,
		TURNING_POINTS,
		type Variation,
		winPercent
	} from '#lib/analysis.ts';
	import {
		gameKey,
		gameUrl,
		pgnFilename,
		parseRating,
		pgnHeader,
		summaryFromPgn,
		winner,
		type GameSummary
	} from '#lib/games.ts';
	import {
		CAUSES,
		CONFIDENCES,
		NOTE_QUESTIONS,
		answeredCount,
		emptyNotes,
		isRevealed,
		notesSignature,
		readNotes,
		writeNotes,
		type Notes
	} from '#lib/notes.ts';
	import {
		findAnalysis,
		forget,
		loadRecent,
		remember,
		saveRecent,
		updatePgn,
		type RecentEntry
	} from '#lib/recent.ts';
	import { saving, savePgn } from '#lib/saving.svelte.ts';
	import { isFalseAlarm, isSpotted, readSpotFlags, spotScore, writeSpotFlags } from '#lib/spot.ts';
	import { playFound, playMissed } from '#lib/sound.svelte.ts';
	import type { Preferences } from '#lib/preferences.ts';

	type Props = { preferences: Preferences; active: boolean };

	let { preferences, active }: Props = $props();

	let pgn = $state('');
	let side = $state<Side>('w');
	let depth = $state(16);
	let lines = $state(3);
	let setupOpen = $state(true);

	let status = $state<'idle' | 'running' | 'done' | 'error'>('idle');
	let message = $state('');
	let startFen = $state('');
	let moves = $state<Move[]>([]);
	let headers = $state<Record<string, string>>({});
	let evals = $state<PositionEval[]>([]);
	let selected = $state(0);
	let flipped = $state(false);
	let opened = $state<Record<number, boolean>>({});
	let checkedBest = $state<Record<number, string>>({});
	let notes = $state<Record<number, Notes>>({});
	let notesOpen = $state<Record<number, boolean>>({});
	let revealed = $state<Record<number, boolean>>({});
	let savedNotes = $state(notesSignature({}));
	let loadedGames = $state<GameSummary[]>([]);
	let loaderTab = $state<'online' | 'saved' | 'recent' | 'pgn'>('online');
	let recent = $state<RecentEntry[]>([]);
	let recentGames = $derived(
		recent.map((entry, i) => ({
			...summaryFromPgn(entry.pgn, i),
			id: `recent:${entry.key}`,
			url: gameUrl(entry.pgn) ?? ''
		}))
	);

	onMount(() => {
		recent = loadRecent();
	});

	function keepRecent(list: RecentEntry[]) {
		recent = list;
		saveRecent(list);
	}
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
	let batchRunning = $state(false);
	let spotting = $state(false);
	let spotFlags = $state<number[]>([]);
	let savedSpot = $state('');
	let autoplay = $state(false);
	let speed = $state(1000);
	const SPEEDS = [500, 1000, 2000, 3000];
	let movesList = $state<HTMLElement>();
	let movesExpanded = $state(false);
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
	let turningPoints = $derived(findTurningPoints(winPercents, TURNING_POINTS, side));
	const RESULT_LABELS = { w: 'White wins', b: 'Black wins', draw: 'Draw' };
	let won = $derived(winner(headers.Result ?? '*'));
	let hasTimes = $derived(moves.some((m) => m.time));
	let turningPlies = $derived(new Set(turningPoints.map((tp) => tp.ply)));
	let shownTurningPlies = $derived(spotting ? new Set<number>() : turningPlies);
	let spotResult = $derived(
		!spotting && spotFlags.length
			? spotScore(
					turningPoints.map((tp) => tp.ply),
					spotFlags
				)
			: null
	);
	let spotPly = $derived(
		spotting && selected < moves.length && (selected % 2 === 0) === (side === 'w')
			? selected + 1
			: null
	);
	let fen = $derived(positionFen(selected));
	let lastMove = $derived(selected > 0 ? moves[selected - 1] : null);
	let boardFen = $derived(exploration?.fens.at(-1) ?? fen);
	let boardHighlight = $derived.by(() => {
		const move = exploration?.moves.at(-1) ?? lastMove;
		return move ? [move.from, move.to] : [];
	});
	let playing = $derived(play && !!exploration);
	let gameOver = $derived(new Chess(boardFen).isGameOver());
	let analyzing = $derived(status === 'running');
	let hiddenTp = $derived(
		spotting
			? null
			: (turningPoints.find(
					(tp) => !revealed[tp.ply] && (selected === tp.ply - 1 || selected === tp.ply)
				) ?? null)
	);
	let candidateTp = $derived(!analyzing && hiddenTp?.ply === selected + 1 ? hiddenTp : null);
	let unsaved = $derived(notesSignature(notes) !== savedNotes || spotFlags.join(' ') !== savedSpot);
	let hasHidden = $derived(turningPoints.some((tp) => !revealed[tp.ply]));
	let graphVisible = $derived(
		spotting
			? 0
			: Math.min(
					Infinity,
					...turningPoints.filter((tp) => !revealed[tp.ply]).map((tp) => tp.ply - 1)
				)
	);
	let evalHidden = $derived(selected >= graphVisible);
	let arrows = $derived.by((): Arrow[] => {
		const tp = turningPoints.find((t) => t.ply - 1 === selected && revealed[t.ply]);
		if (!tp || exploration) return [];
		const move = moves[tp.ply - 1];
		const result: Arrow[] = [{ from: move.from, to: move.to, kind: 'game' }];
		const candidate = notes[tp.ply]?.candidate;
		const squares = candidate ? moveSquares(move.fenBefore, candidate) : null;
		if (squares) result.push({ ...squares, kind: 'candidate' });
		const checked = checkedBest[tp.ply] ? moveSquares(move.fenBefore, checkedBest[tp.ply]) : null;
		const best = checked ?? (evals[tp.ply - 1]?.best ? uciSquares(evals[tp.ply - 1].best!) : null);
		if (best) result.push({ ...best, kind: 'best' });
		return result;
	});
	let barEval = $derived(
		playing || evalHidden ? null : exploration ? explorationEval : (evals[selected] ?? null)
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
			if (candidateTp) {
				const tpNotes = (notes[candidateTp.ply] ??= emptyNotes());
				tpNotes.candidate = move.san;
				tpNotes.verdict = '';
				tpNotes.best = '';
				tpNotes.confidence = '';
			}
		}
		exploration.moves.push(boardMove);
		exploration.sans.push(move.san);
		exploration.fens.push(chess.fen());
		return chess;
	}

	function handleBoardMove(boardMove: BoardMove) {
		autoplay = false;
		if (!exploration && !play && !candidateTp) {
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
			const { uci } = await backend.move(boardFen, elo, current.signal);
			if (!uci) return;
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
	let showSetup = $derived(!moves.length || setupOpen || status === 'error');
	let progress = $derived(positions > 0 ? Math.round((winPercents.length / positions) * 100) : 0);

	function handleEvent(event: AnalyzeEvent) {
		if (event.type === 'start') {
			startFen = event.startFen;
			moves = event.moves;
			headers = event.headers;
			evals = [];
			opened = {};
			checkedBest = {};
			notes = readNotes(pgn);
			savedNotes = notesSignature(notes);
			spotFlags = readSpotFlags(pgn);
			savedSpot = spotFlags.join(' ');
			spotting = !spotFlags.length && !Object.values(notes).some(isRevealed);
			notesOpen = {};
			revealed = Object.fromEntries(
				Object.entries(notes).map(([ply, value]) => [ply, isRevealed(value)])
			);
			cancelEngineMove();
			exploration = null;
			autoplay = false;
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

	function replay(entry: RecentEntry) {
		handleEvent({
			type: 'start',
			startFen: entry.startFen,
			moves: entry.moves,
			headers: entry.headers
		});
		for (const evaluation of entry.evals) handleEvent({ type: 'eval', eval: evaluation });
		status = 'done';
		keepRecent(remember(recent, { ...entry, pgn }));
	}

	async function analyze() {
		if (unsaved && !confirm('Your notes are not saved yet. Discard them?')) return;
		controller?.abort();
		controller = new AbortController();
		message = '';
		setupOpen = false;
		window.scrollTo({ top: 0 });
		const key = gameKey(pgn);
		const cached = findAnalysis(recent, key, depth);
		if (cached) {
			replay(cached);
			return;
		}
		const analyzed = { pgn, depth };
		status = 'running';
		try {
			await backend.analyze(pgn, depth, controller.signal, handleEvent);
			if (status === 'running') status = 'done';
			if (key && status === 'done' && evals.length === positions && evals.every(Boolean)) {
				keepRecent(
					remember(recent, {
						key,
						...analyzed,
						startFen,
						moves,
						headers,
						evals,
						analyzedAt: Date.now()
					})
				);
			}
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

	function toggleNotes(ply: number) {
		notes[ply] ??= emptyNotes();
		notesOpen[ply] = !notesOpen[ply];
	}

	function reveal(ply: number) {
		revealed[ply] = true;
		notes[ply] ??= emptyNotes();
		notesOpen[ply] = true;
		select(ply - 1);
	}

	function clearCandidate(ply: number) {
		notes[ply].candidate = '';
		notes[ply].verdict = '';
		notes[ply].best = '';
		notes[ply].confidence = '';
	}

	function setVerdict(ply: number, found: boolean) {
		if (notes[ply].verdict) return;
		(found ? playFound : playMissed)();
		notes[ply].verdict = found ? 'found' : 'missed';
	}

	function revealAll() {
		for (const tp of turningPoints) revealed[tp.ply] = true;
	}

	function nextHidden() {
		if (analyzing) return;
		const open = turningPoints.filter((tp) => !revealed[tp.ply]);
		const next = open.find((tp) => tp.ply - 1 > selected) ?? open[0];
		if (next) select(next.ply - 1);
	}

	function toggleFlag(ply = spotPly) {
		if (!ply) return;
		if (spotFlags.includes(ply)) spotFlags = spotFlags.filter((flag) => flag !== ply);
		else if (spotFlags.length < TURNING_POINTS)
			spotFlags = [...spotFlags, ply].sort((a, b) => a - b);
	}

	function finishSpotting() {
		autoplay = false;
		spotting = false;
	}

	function skipSpotting() {
		spotFlags = [];
		finishSpotting();
	}

	async function saveNotes() {
		const previous = savedNotes;
		savedNotes = notesSignature(notes);
		const previousSpot = savedSpot;
		savedSpot = spotFlags.join(' ');
		pgn = writeSpotFlags(writeNotes(pgn, notes), spotFlags);
		keepRecent(updatePgn(recent, gameKey(pgn), pgn));
		await savePgn(pgn, pgnFilename(pgn), true);
		if (saving.failed) {
			savedNotes = previous;
			savedSpot = previousSpot;
		}
	}

	function warnUnsaved(event: BeforeUnloadEvent) {
		if (unsaved || batchRunning) event.preventDefault();
	}

	function show(index: number) {
		cancelEngineMove();
		exploration = null;
		selected = Math.min(positions - 1, Math.max(0, index));
	}

	function select(index: number) {
		autoplay = false;
		show(index);
	}

	function toggleAutoplay() {
		if (!autoplay && selected >= positions - 1) show(0);
		autoplay = !autoplay;
	}

	$effect(() => {
		if (!active) autoplay = false;
	});

	$effect(() => {
		if (!autoplay) return;
		const next = selected + 1;
		const timer = setTimeout(() => {
			show(next);
			if (next >= positions - 1 || shownTurningPlies.has(next + 1)) autoplay = false;
		}, speed);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		void selected;
		const current = movesList?.querySelector<HTMLElement>('.current');
		if (!movesList || !current) return;
		if (!movesExpanded) {
			movesList.scrollLeft = current.offsetLeft - (movesList.clientWidth - current.offsetWidth) / 2;
			return;
		}
		const bottom = current.offsetTop + current.offsetHeight;
		if (current.offsetTop < movesList.scrollTop) movesList.scrollTop = current.offsetTop;
		else if (bottom > movesList.scrollTop + movesList.clientHeight)
			movesList.scrollTop = bottom - movesList.clientHeight;
	});

	function closeSetup() {
		if (!batchRunning) setupOpen = false;
	}

	function handleKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && active && moves.length && showSetup) {
			closeSetup();
			return;
		}
		const tag = (event.target as HTMLElement).tagName;
		if (!active || !moves.length || ['TEXTAREA', 'INPUT', 'SELECT'].includes(tag)) return;
		if (event.key === 'n' && !spotting) nextHidden();
		if (event.key === ' ' && spotting) {
			event.preventDefault();
			toggleFlag();
		}
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
</script>

<svelte:window onkeydown={handleKey} onbeforeunload={warnUnsaved} />

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

{#snippet setupPanel()}
	<section class="card load">
		<h2 class="card-title">Load a game</h2>
		{#if !moves.length}
			<p class="muted small">
				New here? <a class="guide-link" href={resolve('/guide')}>Read the guide →</a>
			</p>
		{/if}
		<GameLoader
			onselect={loadGame}
			bind:games={loadedGames}
			bind:tab={loaderTab}
			bind:pgn
			recent={recentGames}
			onforget={(id) => keepRecent(forget(recent, id.slice('recent:'.length)))}
			onclear={() => keepRecent([])}
			onanalyzed={(entry) => keepRecent(remember(recent, entry))}
			onbatch={(running) => (batchRunning = running)}
			{depth}
			{preferences}
			{active}
		/>
		<SaveFolder folder={preferences.folder} />
	</section>

	<section class="card settings">
		<h2 class="card-title">Analysis</h2>
		{#if !moves.length}
			<div class="controls">
				<label>
					<span>Analyze for</span>
					<select bind:value={side} onchange={() => (flipped = side === 'b')}>
						<option value="w">{pgnHeader(pgn, 'White') ?? 'White'} (White)</option>
						<option value="b">{pgnHeader(pgn, 'Black') ?? 'Black'} (Black)</option>
					</select>
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
		{/if}
		{#if status === 'running'}
			<button class="analyze" onclick={stop}>Stop</button>
			<div class="progress" role="progressbar" aria-valuenow={progress}>
				<div class="progress-fill" style:width="{progress}%"></div>
			</div>
			<span class="muted small">Analyzing… {winPercents.length}/{positions} positions</span>
		{:else}
			<button class="primary analyze" onclick={analyze} disabled={!pgn.trim() || batchRunning}
				>Analyze game</button
			>
		{/if}
		{#if status === 'error'}
			<p class="error">{message}</p>
		{/if}
	</section>
{/snippet}

<main class:hidden={!active} class:loaded={moves.length > 0}>
	<div class="head-area">
		<Header>
			<div class="toolbar">
				{#if moves.length}
					{#if status === 'running'}
						<div class="progress inline" role="progressbar" aria-valuenow={progress}>
							<div class="progress-fill" style:width="{progress}%"></div>
						</div>
						<span class="muted small">{winPercents.length}/{positions}</span>
						<button onclick={stop}>Stop</button>
					{:else}
						<div
							class="quick-settings muted small"
							title={unsaved ? 'Save your notes first' : undefined}
						>
							<label>
								For
								<select
									bind:value={side}
									onchange={() => (flipped = side === 'b')}
									disabled={unsaved}
								>
									<option value="w">{headers.White ?? 'White'} (White)</option>
									<option value="b">{headers.Black ?? 'Black'} (Black)</option>
								</select>
							</label>
							<label>
								Depth
								<input
									type="number"
									min="6"
									max="30"
									bind:value={depth}
									onchange={analyze}
									disabled={unsaved}
								/>
							</label>
							<label>
								Lines
								<input type="number" min="1" max="5" bind:value={lines} disabled={unsaved} />
							</label>
						</div>
					{/if}
					<button
						class="setup-toggle"
						class:open={showSetup}
						onclick={() => (setupOpen = !showSetup)}
						disabled={batchRunning}
						aria-expanded={showSetup}
						title="{showSetup ? 'Hide' : 'Show'} game loading and analysis settings"
					>
						⚙ Game & settings <span class="chevron" aria-hidden="true">▾</span>
					</button>
				{/if}
			</div>
		</Header>
		{#if showSetup && moves.length}
			<button
				class="backdrop"
				aria-label="Close game and settings"
				tabindex="-1"
				onclick={closeSetup}
				transition:fade={{ duration: ms(160) }}
			></button>
			<div class="top overlay" transition:fly={{ y: -8, duration: ms(160) }}>
				{@render setupPanel()}
			</div>
		{/if}
	</div>

	{#if moves.length}
		<h1 class="sr-only">Analysis</h1>
	{:else}
		<section class="welcome">
			<h1>Find the moments where your game turned</h1>
			<p class="lead">
				The moves where the evaluation swung the most. Study those positions first, before looking
				at the engine.
			</p>
		</section>
	{/if}

	{#if showSetup && !moves.length}
		<div class="top">{@render setupPanel()}</div>
	{/if}

	{#if moves.length}
		<div class="results" in:fade={{ duration: ms(300) }}>
			<div class="layout">
				<section class="card board-panel">
					<div
						class="board-row"
						class:awaiting={!!candidateTp && !notes[candidateTp.ply]?.candidate}
					>
						<EvalBar
							score={barEval?.score ?? null}
							winPercent={barEval?.winPercent ?? 50}
							{flipped}
							hidden={evalHidden && !playing}
						/>
						<Board
							fen={boardFen}
							{flipped}
							highlight={boardHighlight}
							{arrows}
							onmove={engineThinking ? undefined : handleBoardMove}
						/>
					</div>
					<div class="nav">
						<button onclick={() => select(0)} aria-label="Start">⏮</button>
						<button onclick={() => select(selected - 1)} aria-label="Previous">◀</button>
						<button onclick={() => select(selected + 1)} aria-label="Next">▶</button>
						<button onclick={() => select(positions - 1)} aria-label="End">⏭</button>
						<button
							class:on={autoplay}
							onclick={toggleAutoplay}
							aria-label={autoplay ? 'Pause' : 'Autoplay'}
						>
							<svg viewBox="0 0 16 16" aria-hidden="true">
								{#if autoplay}
									<path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
								{:else}
									<path d="M4 2.5v11l9-5.5z" />
								{/if}
							</svg>
						</button>
						<select bind:value={speed} aria-label="Autoplay speed">
							{#each SPEEDS as s (s)}<option value={s}>{s / 1000} s</option>{/each}
						</select>
						<button class="flip" onclick={() => (flipped = !flipped)}>⇅ Flip</button>
					</div>
					<div class="moves-block">
						<div class="moves" class:expanded={movesExpanded} bind:this={movesList}>
							{#each moves as move (move.ply)}
								<button
									class="move"
									class:current={selected === move.ply}
									class:turning={shownTurningPlies.has(move.ply)}
									class:flagged={spotFlags.includes(move.ply)}
									class:false-alarm={!!spotResult &&
										spotFlags.includes(move.ply) &&
										isFalseAlarm(
											move.ply,
											turningPoints.map((tp) => tp.ply)
										)}
									onclick={() => select(move.ply)}
									title={move.time ? describeTime(move.time) : undefined}
								>
									{#if move.ply % 2 === 1}<span class="num">{(move.ply + 1) / 2}.</span
										>{/if}{move.san}
								</button>
							{/each}
						</div>
						<button
							class="moves-toggle"
							onclick={() => (movesExpanded = !movesExpanded)}
							aria-expanded={movesExpanded}>{movesExpanded ? 'Less' : 'All moves'}</button
						>
					</div>
					<div class="panel-body">
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
										{:else if candidateTp && notes[candidateTp.ply]?.candidate}
											<span class="muted">Candidate: {notes[candidateTp.ply].candidate}</span>
										{:else if evalHidden}
											<span class="muted">Evaluation hidden until you reveal</span>
										{:else if explorationPending || !explorationEval}
											<span class="muted">Calculating…</span>
										{:else}
											{formatScore(explorationEval.score)}
										{/if}
									</span>
								</div>
								<div class="line">
									{formatLine(positionFen(exploration.base), exploration.sans)}
								</div>
								{#if engineError}<p class="error">{engineError}</p>{/if}
								<div class="nav">
									<button onclick={undoExploration}>Undo move</button>
									<button onclick={() => select(exploration!.base)}>Back to game</button>
								</div>
								{@render playControls()}
								{#if !playing && !evalHidden}
									<details bind:open={showEngine}>
										<summary>Engine lines</summary>
										<Variations fen={boardFen} {depth} {lines} onresult={handleExplorationResult} />
									</details>
								{/if}
							</div>
						{:else}
							<p class="position">
								<strong
									>{lastMove ? moveLabel(lastMove.ply, lastMove.san) : 'Start position'}</strong
								>
								{#if evals[selected] && !evalHidden}<span class="pill"
										>{formatScore(evals[selected].score)}</span
									>{/if}
								{#if candidateTp && !spotting}
									<span class="your-turn"
										>Your move · {boardFen.split(' ')[1] === 'w' ? 'White' : 'Black'}</span
									>
									<span class="muted small">First: what does your opponent want?</span>
								{:else}
									<span class="muted small"
										>{spotting
											? 'Spotting: flag the deciding moves'
											: hiddenTp && analyzing
												? 'Wait for the analysis to finish'
												: evalHidden
													? 'Evaluation hidden until you reveal'
													: play
														? 'Make a move to start playing'
														: 'Move a piece to try your own line'}</span
									>
								{/if}
							</p>
							{#if arrows.length}
								<p class="legend muted small">
									<span class="key best">Engine</span>
									{#if arrows.some((arrow) => arrow.kind === 'candidate')}
										<span class="key candidate">Your candidate</span>
									{/if}
									<span class="key game">Game</span>
								</p>
							{/if}
							{@render playControls()}
							{#if !evalHidden}
								<details class="engine" bind:open={showEngine}>
									<summary>Engine lines</summary>
									{#if showEngine}
										<Variations {fen} {depth} {lines} />
									{/if}
								</details>
							{/if}
						{/if}
					</div>
				</section>

				<div class="side">
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
							turningPoints={spotting ? [] : turningPoints}
							{selected}
							visible={graphVisible}
							onselect={select}
						/>
						{#if hasTimes}
							<TimeChart {moves} turningPlies={shownTurningPlies} {selected} onselect={select} />
						{/if}
					</section>
					<section class="card points">
						<h2 class="card-title">Turning points</h2>
						{#if spotting}
							<div class="spot" transition:slide={{ duration: ms(200) }}>
								<p class="small">
									Step through your game with <kbd>→</kbd> or autoplay. On each of your moves that
									you think decided the game, press <strong>Flag</strong> or <kbd>Space</kbd>. You
									can flag up to {TURNING_POINTS}.
								</p>
								<div class="training">
									<button
										class="primary"
										onclick={() => toggleFlag()}
										disabled={!spotPly ||
											(!spotFlags.includes(spotPly) && spotFlags.length >= TURNING_POINTS)}
										>{spotPly && spotFlags.includes(spotPly) ? 'Unflag' : 'Flag'}
										{spotPly ? moveLabel(spotPly, moves[spotPly - 1].san) : 'your move'}</button
									>
									<button onclick={finishSpotting} disabled={!spotFlags.length || analyzing}
										>Check</button
									>
									<button onclick={skipSpotting}>Skip</button>
									<span class="muted small"
										>{spotFlags.length} / {TURNING_POINTS} flagged{analyzing
											? ' · Check after the analysis'
											: ''}</span
									>
								</div>
								{#if spotFlags.length}
									<p class="flags">
										{#each spotFlags as flag (flag)}
											<span class="flag"
												>⚑ <button class="link" onclick={() => select(flag - 1)}
													>{moveLabel(flag, moves[flag - 1].san)}</button
												><button
													class="link"
													onclick={() => toggleFlag(flag)}
													aria-label="Remove flag">✕</button
												></span
											>
										{/each}
									</p>
								{/if}
							</div>
						{:else}
							{#if spotResult}
								<p class="spot-result small">
									👁 You spotted <strong>{spotResult.spotted} of {spotResult.total}</strong>
									{#if spotResult.falseAlarms}· {spotResult.falseAlarms}
										{spotResult.falseAlarms === 1 ? 'false alarm' : 'false alarms'}{/if}
								</p>
							{/if}
							{#if hasHidden}
								<div class="training">
									<button onclick={nextHidden} disabled={analyzing} title="Shortcut: N"
										>Next open turning point</button
									>
									<button onclick={revealAll} disabled={analyzing}>Reveal all</button>
									{#if analyzing}<span class="muted small">Wait for the analysis to finish</span
										>{/if}
								</div>
							{/if}
							{#if !turningPoints.length}
								<p class="muted">
									{analyzing
										? 'Waiting for the engine…'
										: `No turning points: none of your moves changed your winning chances by ${MIN_SWING}% or more.`}
								</p>
							{/if}
							<ol>
								{#each turningPoints as tp, i (tp.ply)}
									{@const move = moves[tp.ply - 1]}
									{@const before = evals[tp.ply - 1]}
									{@const after = evals[tp.ply]}
									{@const hidden = !revealed[tp.ply]}
									{@const judgement = hidden ? null : judgeMove(tp.delta)}
									<li
										class="tp {judgement?.name ?? ''}"
										class:active={selected === tp.ply - 1 || selected === tp.ply}
										animate:flip={{ duration: ms(250) }}
										in:fly={{ y: 16, duration: ms(300), delay: ms(i * 70) }}
									>
										<div class="tp-row">
											<button class="link" onclick={() => select(tp.ply - 1)}>
												{moveLabel(tp.ply, move.san)}{#if judgement}<span
														class="judgement {judgement.name}"
														title={judgement.name}>{judgement.symbol}</span
													>{/if}
											</button>
											{#if hidden}
												<span class="evals">? → ?</span>
											{:else}
												<span
													class="evals"
													title="Winning chances {tp.delta > 0 ? '+' : ''}{tp.delta.toFixed(1)}%"
												>
													<CountUp score={before.score} /> → <CountUp score={after.score} />
												</span>
											{/if}
											{#if move.time}
												<span class="time" title={describeTime(move.time)}
													>⏱ {formatDuration(move.time.spent)}</span
												>
											{/if}
											{#if spotResult && isSpotted(tp.ply, spotFlags)}
												<span class="spotted" title="You spotted this turning point">👁</span>
											{/if}
											{#if hidden && notes[tp.ply]?.candidate}
												<span class="candidate" title="Your candidate move"
													>✎ {notes[tp.ply].candidate}</span
												>
											{/if}
											<span class="tp-actions">
												<button onclick={() => select(tp.ply - 1)}>Before</button>
												{#if !hidden}
													<button onclick={() => select(tp.ply)}>After</button>
													<button
														class:on={opened[tp.ply]}
														onclick={() => (opened[tp.ply] = !opened[tp.ply])}
														aria-expanded={!!opened[tp.ply]}
														title="Engine suggestion">Engine</button
													>
												{/if}
												<button
													class:on={notesOpen[tp.ply]}
													onclick={() => toggleNotes(tp.ply)}
													aria-expanded={!!notesOpen[tp.ply]}
													title="Three questions">Notes {answeredCount(notes[tp.ply])}/3</button
												>
												{#if hidden}
													<button class="reveal" onclick={() => reveal(tp.ply)} disabled={analyzing}
														>{notes[tp.ply]?.candidate ? 'Reveal' : 'Reveal without a move'}</button
													>
												{:else if notes[tp.ply]?.candidate}
													<button
														onclick={() => clearCandidate(tp.ply)}
														title="Remove the candidate and its result from the stats">Reset</button
													>
												{/if}
											</span>
										</div>
										{#if hidden && notes[tp.ply]?.candidate}
											<div class="confidence">
												<span class="muted small">How sure are you?</span>
												{#each CONFIDENCES as { value, label } (value)}
													<button
														class:on={notes[tp.ply].confidence === value}
														onclick={() =>
															(notes[tp.ply].confidence =
																notes[tp.ply].confidence === value ? '' : value)}>{label}</button
													>
												{/each}
											</div>
										{/if}
										{#if notesOpen[tp.ply] && notes[tp.ply]}
											<div class="notes" transition:slide={{ duration: ms(200) }}>
												{#each NOTE_QUESTIONS.slice(0, hidden ? 1 : 3) as { question }, q (question)}
													<label>
														<span>{q + 1}. {question}</span>
														<textarea rows="2" bind:value={notes[tp.ply].answers[q]}></textarea>
													</label>
												{/each}
												{#if !hidden}
													<div class="cause">
														<span>What went wrong in the game?</span>
														<div>
															{#each CAUSES as { value, label, hint } (value)}
																<button
																	class:on={notes[tp.ply].cause === value}
																	title={hint}
																	onclick={() =>
																		(notes[tp.ply].cause =
																			notes[tp.ply].cause === value ? '' : value)}>{label}</button
																>
															{/each}
														</div>
													</div>
													<label>
														<span>Next time, when …, then …</span>
														<textarea
															rows="2"
															placeholder="When my opponent's queen leaves the king, then I look for checks first."
															bind:value={notes[tp.ply].lesson}></textarea>
													</label>
												{/if}
											</div>
										{/if}
										{#if !hidden && notes[tp.ply]?.candidate}
											<CandidateCheck
												{move}
												candidate={notes[tp.ply].candidate}
												{before}
												{after}
												{depth}
												{side}
												verdict={notes[tp.ply].verdict}
												onverdict={(found, best, line) => {
													if (best) checkedBest[tp.ply] = best;
													if (!notes[tp.ply].best) notes[tp.ply].best = line.slice(0, 4).join(' ');
													setVerdict(tp.ply, found);
												}}
											/>
										{/if}
										{#if opened[tp.ply] && !hidden}
											<div transition:slide={{ duration: ms(200) }}>
												<Variations fen={move.fenBefore} {depth} {lines} />
											</div>
										{/if}
									</li>
								{/each}
							</ol>
						{/if}
						{#if turningPoints.length && !spotting}
							<div class="save-notes">
								<button onclick={saveNotes} disabled={!pgn.trim()} class:unsaved>Save notes</button>
								{#if unsaved && !saving.failed}
									<span class="muted small">Unsaved changes</span>
								{:else if saving.message}
									<span class="muted small" class:error={saving.failed}>{saving.message}</span>
								{/if}
							</div>
						{/if}
					</section>
				</div>
			</div>
		</div>
	{/if}
</main>

<style>
	.legend {
		display: flex;
		gap: 14px;
		margin: 0;
	}

	.key::before {
		content: '';
		display: inline-block;
		width: 14px;
		height: 3px;
		margin-right: 6px;
		vertical-align: middle;
		border-radius: 2px;
		background: #5cc98a;
	}

	.key.candidate::before {
		background: #e3b341;
	}

	.key.game::before {
		background: #f06a6a;
	}

	main.hidden {
		display: none;
	}

	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 16px 20px 80px;
		display: grid;
		gap: 22px;
	}

	main.loaded {
		padding-bottom: 16px;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		min-height: 46px;
	}

	.setup-toggle.open {
		border-color: var(--accent);
		color: var(--accent-2);
	}

	.chevron {
		display: inline-block;
		transition: transform 200ms ease;
	}

	.setup-toggle.open .chevron {
		transform: rotate(180deg);
	}

	.quick-settings {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.quick-settings label {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.quick-settings input,
	.quick-settings select {
		padding: 4px 6px;
	}

	.quick-settings input {
		width: 3.5em;
	}

	.spot {
		display: grid;
		gap: 8px;
	}

	.spot p {
		margin: 0;
	}

	.flags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 12px;
	}

	.flag {
		color: var(--accent-2);
	}

	.spot-result {
		margin: 0 0 8px;
	}

	.spotted {
		font-size: 0.85rem;
	}

	.move.flagged {
		box-shadow: inset 0 -2px 0 var(--accent-2);
	}

	.move.flagged.false-alarm {
		box-shadow: inset 0 -2px 0 var(--muted);
		color: var(--muted);
	}

	kbd {
		padding: 0 5px;
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		font: inherit;
		font-size: 0.85em;
	}

	.guide-link {
		color: var(--accent-2);
		text-decoration: none;
	}

	.guide-link:hover {
		text-decoration: underline;
	}

	.progress.inline {
		width: 140px;
	}

	.welcome {
		padding: 18px 0 4px;
	}

	.welcome h1 {
		margin: 0;
		font-size: clamp(1.7rem, 3vw, 2.2rem);
		font-weight: 750;
		letter-spacing: -0.02em;
	}

	.lead {
		color: var(--muted);
		margin: 6px 0 0;
		max-width: 70ch;
		line-height: 1.5;
	}

	.head-area {
		position: relative;
		z-index: 30;
	}

	.head-area > :global(header) {
		position: relative;
		z-index: 2;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: rgb(8 10 14 / 0.5);
		cursor: default;
	}

	.backdrop:hover {
		background: rgb(8 10 14 / 0.5);
	}

	.overlay {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		right: 0;
		z-index: 2;
		max-height: calc(100vh - 110px);
		overflow: auto;
		padding: 14px;
		border: 1px solid var(--border-strong);
		border-radius: 18px;
		background: var(--surface);
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.55);
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
		grid-template-columns: auto minmax(0, 1fr);
		gap: 22px;
		align-items: start;
	}

	.side {
		display: grid;
		gap: 22px;
		align-content: start;
	}

	.board-row {
		display: flex;
		gap: 8px;
		width: clamp(400px, calc(100svh - 360px), 520px);
	}

	@media (min-width: 901px) {
		.board-panel {
			width: min-content;
			max-height: max(calc(100svh - 100px), 600px);
			overflow: hidden;
			box-sizing: border-box;
			display: flex;
			flex-direction: column;
		}

		.board-row,
		.board-panel > .nav {
			flex: none;
		}

		.panel-body {
			flex: 1;
			min-height: 0;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
		}

		.layout {
			align-items: stretch;
		}

		.side {
			height: 0;
			min-height: 100%;
			grid-template-rows: auto minmax(0, 1fr);
		}

		.points {
			overflow-y: auto;
			scrollbar-gutter: stable;
		}
	}

	@media (max-width: 900px) {
		.top,
		.layout {
			grid-template-columns: 1fr;
		}

		.board-row {
			width: 100%;
			max-width: 520px;
		}
	}

	.nav {
		display: flex;
		gap: 6px;
		margin-top: 12px;
	}

	.nav button {
		min-width: 42px;
	}

	.nav svg {
		width: 0.9em;
		height: 0.9em;
		fill: currentColor;
		vertical-align: -0.1em;
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
		gap: 6px;
	}

	.tp {
		position: relative;
		padding: 7px 10px 7px 16px;
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

	.tp-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}

	.link {
		background: none;
		border: none;
		padding: 0;
		font-weight: 700;
		font-size: 1rem;
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
	}

	.your-turn {
		color: var(--accent-2);
		font-weight: 650;
	}

	.candidate {
		color: var(--accent-2);
		font-size: 0.85rem;
		font-weight: 650;
	}

	.evals {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}

	.judgement {
		display: inline-block;
		animation: pop-in 0.35s cubic-bezier(0.3, 1.6, 0.5, 1) both;
	}

	@keyframes pop-in {
		from {
			transform: scale(0);
			opacity: 0;
		}
	}

	.judgement.inaccuracy {
		color: #56b4e9;
	}

	.judgement.mistake {
		color: #e69f00;
	}

	.judgement.blunder {
		color: #df5353;
		animation:
			pop-in 0.35s cubic-bezier(0.3, 1.6, 0.5, 1) both,
			pulse 0.6s ease-out 0.4s 2;
	}

	@keyframes pulse {
		50% {
			transform: scale(1.4);
		}
	}

	.tp-actions {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}

	.tp-actions button {
		padding: 3px 9px;
		font-size: 0.8rem;
	}

	.nav button.on,
	.tp-actions .reveal {
		border-color: var(--accent);
		color: var(--accent-2);
	}

	.training {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 10px;
	}

	.training button {
		padding: 3px 9px;
		font-size: 0.8rem;
	}

	.confidence {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-top: 6px;
	}

	.confidence span {
		margin-right: 4px;
	}

	.cause {
		display: grid;
		gap: 4px;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.cause div {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.confidence button,
	.cause button {
		padding: 3px 9px;
		font-size: 0.8rem;
	}

	.confidence button.on,
	.cause button.on,
	.tp-actions button.on {
		border-color: var(--accent);
		color: var(--accent-2);
	}

	.notes {
		display: grid;
		gap: 8px;
		padding: 10px 0 4px;
	}

	.notes label {
		display: grid;
		gap: 4px;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.notes textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		font-family: ui-monospace, 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.save-notes {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: -12px 0 22px;
	}

	.save-notes .unsaved {
		border-color: var(--accent);
		color: var(--accent-2);
	}

	.board-row.awaiting {
		outline: 2px solid var(--accent-2);
		outline-offset: 3px;
		border-radius: 6px;
	}

	.moves-block {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		width: 0;
		min-width: 100%;
		margin-top: 10px;
	}

	.moves {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		gap: 5px;
		overflow-x: auto;
		scrollbar-width: none;
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 16px,
			#000 calc(100% - 16px),
			transparent
		);
	}

	.moves .move {
		flex-shrink: 0;
	}

	.moves.expanded {
		flex-wrap: wrap;
		overflow-x: hidden;
		mask-image: none;
		height: calc(4 * 26px + 3 * 5px);
		min-height: calc(2 * 26px + 5px);
		max-height: fit-content;
		resize: vertical;
		overflow-y: auto;
		scrollbar-gutter: stable;
		align-content: flex-start;
	}

	.moves-toggle {
		flex-shrink: 0;
		padding: 3px 8px;
		line-height: 18px;
		font-size: 0.8rem;
	}

	.move {
		padding: 3px 8px;
		line-height: 18px;
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
