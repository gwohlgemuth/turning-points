<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import backend from '#backend';
	import { ms } from '#lib/motion.ts';
	import { TURNING_POINTS, type Side } from '#lib/analysis.ts';
	import { analyzeGame, markTurningPoints } from '#lib/batch.ts';
	import type { RecentEntry } from '#lib/recent.ts';
	import {
		GAME_COUNTS,
		filterGames,
		formatGameDate,
		gameKey,
		gameOutcome,
		gamesToPgn,
		pgnFilename,
		playerSide,
		playersByCount,
		splitPgn,
		summaryFromPgn,
		today,
		winner,
		type GameSource,
		type GameSummary,
		type Outcome
	} from '#lib/games.ts';
	import type { SavedGame } from '#lib/stats.ts';
	import { savePgn, saving } from '#lib/saving.svelte.ts';
	import { updatePreferences, type LoaderTab, type Preferences } from '#lib/preferences.ts';

	type Props = {
		onselect: (game: GameSummary, side: Side) => void;
		games?: GameSummary[];
		tab?: LoaderTab;
		pgn?: string;
		recent?: GameSummary[];
		onforget?: (id: string) => void;
		onclear?: () => void;
		onanalyzed?: (entry: RecentEntry) => void;
		onbatch?: (running: boolean) => void;
		depth: number;
		preferences: Preferences;
		active?: boolean;
	};

	let {
		onselect,
		games = $bindable([]),
		tab = $bindable('online'),
		pgn = $bindable(''),
		recent = [],
		onforget,
		onclear,
		onanalyzed,
		onbatch,
		depth,
		preferences,
		active = true
	}: Props = $props();

	const initial = untrack(() => preferences);
	let source = $state<GameSource>(import.meta.env.STATIC ? 'lichess' : initial.source);
	let username = $state(initial.username);
	let max = $state(initial.max);
	let loading = $state(false);
	let slideList = $state(false);
	let message = $state('');
	let selectedId = $state('');
	let loadedUser = $state(initial.username);
	let saved = $state<SavedGame[]>([]);
	let savedLoaded = $state(false);
	let showAll = $state(false);
	let worked = $derived(saved.filter((game) => game.worked > 0));
	let query = $state('');
	let outcomeFilter = $state<Outcome | ''>('');
	let list = $derived<GameSummary[]>(
		tab === 'online'
			? games
			: tab === 'saved'
				? showAll
					? saved
					: worked
				: tab === 'recent'
					? recent
					: []
	);
	let savedByUrl = $derived(new Map(saved.filter((game) => game.url).map((g) => [g.url, g])));
	const players = $derived(playersByCount(list));
	let perspective = $derived(
		players.find((name) => name.toLowerCase() === loadedUser.toLowerCase()) ?? players[0] ?? ''
	);

	let shown = $derived(filterGames(list, query, perspective ? outcomeFilter : '', perspective));

	async function loadSaved() {
		try {
			saved = await backend.saved(saving.folder);
		} catch (err) {
			if (tab === 'saved') message = (err as Error).message;
		} finally {
			savedLoaded = true;
		}
	}

	function showTab(next: LoaderTab) {
		slideList = false;
		tab = next;
		message = '';
		updatePreferences({ tab: next });
		loadSaved();
		if (next === 'online') fetchIfEmpty();
	}

	function fetchIfEmpty() {
		if (username.trim() && !games.length && !loading) fetchGames();
	}

	$effect(() => {
		if (active) untrack(loadSaved);
	});

	async function deleteSaved(game: SavedGame) {
		if (!confirm('Delete this game and its notes?')) return;
		try {
			await backend.deleteGame!(game.file);
		} catch (err) {
			message = (err as Error).message;
		}
		loadSaved();
	}

	const progress = (game: GameSummary): SavedGame | undefined =>
		'worked' in game ? (game as SavedGame) : savedByUrl.get(game.url);

	function load(event: SubmitEvent) {
		event.preventDefault();
		fetchGames();
	}

	onMount(() => {
		if (tab === 'online') fetchIfEmpty();
	});

	async function fetchGames() {
		slideList = true;
		loading = true;
		message = '';
		games = [];
		loadedUser = username.trim();
		updatePreferences({ source, username: username.trim(), max });
		try {
			games = await backend.games(source, username.trim(), max);
			if (!games.length) message = 'No games found';
			loadSaved();
		} catch (err) {
			message = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function choose(game: GameSummary) {
		selectedId = game.id;
		onselect(game, playerSide(game, perspective) ?? 'w');
	}

	async function loadFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const text = await file.text();
		const found = splitPgn(text);
		if (found.length > 1) {
			games = found.map(summaryFromPgn);
			showTab('online');
		} else pgn = text;
	}

	function save() {
		savePgn(gamesToPgn(games), `${username.trim() || 'games'}-${today()}.pgn`);
	}

	let batch = $state<{ done: number; total: number } | null>(null);
	let batchController: AbortController | null = null;
	let unworked = $derived(shown.filter((game) => !progress(game)?.worked));

	async function analyzeAll() {
		const queue = [...unworked];
		batchController = new AbortController();
		batch = { done: 0, total: queue.length };
		onbatch?.(true);
		message = '';
		try {
			for (const game of queue) {
				const side = playerSide(game, perspective) ?? 'w';
				const result = await analyzeGame(game.pgn, depth, batchController.signal);
				const pgn = markTurningPoints(game.pgn, result.evals, TURNING_POINTS, side);
				await savePgn(pgn, pgnFilename(pgn));
				if (saving.failed) throw new Error(saving.message);
				const key = gameKey(pgn);
				if (key) onanalyzed?.({ key, pgn, depth, ...result, analyzedAt: Date.now() });
				batch.done++;
			}
			saving.message = `Analyzed and saved ${queue.length} ${queue.length === 1 ? 'game' : 'games'}`;
		} catch (err) {
			if ((err as Error).name !== 'AbortError') message = (err as Error).message;
		} finally {
			batch = null;
			batchController = null;
			onbatch?.(false);
			loadSaved();
		}
	}

	const OUTCOME_LABELS = { win: 'Win', loss: 'Loss', draw: 'Draw' };
</script>

<div class="tabs" role="tablist">
	<button
		role="tab"
		aria-selected={tab === 'online'}
		class:on={tab === 'online'}
		disabled={!!batch}
		onclick={() => showTab('online')}>Online</button
	>
	<button
		role="tab"
		aria-selected={tab === 'saved'}
		class:on={tab === 'saved'}
		disabled={!!batch}
		onclick={() => showTab('saved')}>My games</button
	>
	<button
		role="tab"
		aria-selected={tab === 'recent'}
		class:on={tab === 'recent'}
		disabled={!!batch}
		onclick={() => showTab('recent')}>Recent</button
	>
	<button
		role="tab"
		aria-selected={tab === 'pgn'}
		class:on={tab === 'pgn'}
		disabled={!!batch}
		onclick={() => showTab('pgn')}>PGN</button
	>
</div>

<div class="tab-controls">
	{#if tab === 'online'}
		<form class="loader" onsubmit={load} autocomplete="off">
			{#if !import.meta.env.STATIC}
				<select
					bind:value={source}
					onchange={() => updatePreferences({ source })}
					aria-label="Source"
				>
					<option value="lichess">Lichess</option>
					<option value="chesscom">Chess.com</option>
				</select>
			{/if}
			<input
				bind:value={username}
				placeholder={import.meta.env.STATIC ? 'Lichess username' : 'Username'}
				aria-label="Username"
				required
			/>
			<select
				bind:value={max}
				onchange={() => updatePreferences({ max })}
				aria-label="Number of games"
			>
				{#each GAME_COUNTS as count (count)}
					<option value={count}>{count} games</option>
				{/each}
			</select>
			<button type="submit" disabled={loading || !username.trim()}>
				{loading ? 'Loading…' : 'Load games'}
			</button>
		</form>
	{:else if tab === 'saved'}
		{#if saved.length > worked.length}
			<label class="show-all">
				<input type="checkbox" bind:checked={showAll} />
				Show games without notes ({saved.length - worked.length})
			</label>
		{:else if savedLoaded && !saved.length && !message}
			<span class="muted">No saved games yet. Games you save appear here.</span>
		{/if}
	{:else if tab === 'pgn'}
		<div class="file-row">
			<input type="file" accept=".pgn,text/plain" onchange={loadFile} aria-label="Open PGN file" />
			<button onclick={() => savePgn(pgn, pgnFilename(pgn))} disabled={!pgn.trim()}>Save</button>
		</div>
	{:else if recent.length}
		<button onclick={() => confirm('Remove all games from Recent?') && onclear?.()}
			>Clear recent</button
		>
	{:else}
		<span class="muted">No recent games yet. Games you analyze appear here.</span>
	{/if}
</div>

{#if message}
	<p class="muted">{message}</p>
{/if}

{#if tab === 'pgn'}
	<textarea bind:value={pgn} rows="8" placeholder="Paste a PGN here" aria-label="PGN"></textarea>
{/if}

{#if list.length}
	<div class="filters">
		<input
			type="search"
			bind:value={query}
			placeholder="Search players or date"
			aria-label="Search games"
		/>
		{#if perspective}
			<div class="outcomes" role="group" aria-label="Filter by result">
				{#each [['', 'All'], ['win', 'Win'], ['draw', 'Draw'], ['loss', 'Loss']] as const as [value, label] (value)}
					<button class:on={outcomeFilter === value} onclick={() => (outcomeFilter = value)}
						>{label}</button
					>
				{/each}
			</div>
		{/if}
	</div>
	<label class="perspective">
		<span class="muted">View as</span>
		<select bind:value={perspective}>
			<option value="">Neutral</option>
			{#each players as name (name)}
				<option value={name}>{name}</option>
			{/each}
		</select>
	</label>
	<ul class="games" in:slide={{ duration: slideList ? ms(200) : 0 }}>
		{#each shown as game (game.id)}
			{@const won = winner(game.result)}
			{@const mine = gameOutcome(game, perspective)}
			{@const info = progress(game)}
			<li>
				<button
					class:selected={selectedId === game.id}
					disabled={!!batch}
					onclick={() => choose(game)}
				>
					{#if perspective}
						<span class="outcome {mine ?? ''}">{mine ? OUTCOME_LABELS[mine] : ''}</span>
					{/if}
					<span class="players">
						{#each [{ side: 'w', name: game.white, rating: game.whiteRating }, { side: 'b', name: game.black, rating: game.blackRating }] as p (p.side)}
							<span
								class="player"
								class:winner={won === p.side}
								class:loser={won !== null && won !== 'draw' && won !== p.side}
							>
								<span class="piece {p.side}" aria-hidden="true"></span>
								<span class="name">{p.name}</span>
								{#if p.rating}<span class="rating">{p.rating}</span>{/if}
								{#if won === p.side}
									<span class="crown" title="Winner">♚</span>
								{:else if won === 'draw'}
									<span class="half" title="Draw">½</span>
								{/if}
							</span>
						{/each}
					</span>
					{#if info && (info.worked || tab !== 'saved')}
						<span
							class="badge"
							title="{info.worked} turning points worked on · {info.found} found · {info.missed} missed"
							>{info.worked
								? `✎ ${info.worked} ${info.worked === 1 ? 'note' : 'notes'}`
								: 'Saved'}</span
						>
					{/if}
					<span class="meta">
						{[game.timeClass, formatGameDate(game.date)].filter(Boolean).join(' · ')}
					</span>
				</button>
				{#if tab === 'recent'}
					<button
						class="forget"
						onclick={() => onforget?.(game.id)}
						title="Remove from recent"
						aria-label="Remove from recent">✕</button
					>
				{:else if tab === 'saved' && backend.deleteGame}
					<button
						class="forget"
						onclick={() => deleteSaved(game as SavedGame)}
						title="Delete game"
						aria-label="Delete game">✕</button
					>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="list-footer">
		<span class="muted"
			>{shown.length === list.length ? '' : `${shown.length} of `}{list.length} games</span
		>
		{#if tab === 'online'}
			<div class="actions">
				{#if batch}
					<span class="muted">Analyzing {batch.done + 1}/{batch.total}…</span>
					<button onclick={() => batchController?.abort()}>Stop</button>
				{:else}
					{#if !perspective}
						<span class="muted small">Choose a player under View as</span>
					{/if}
					<button
						class="primary"
						onclick={analyzeAll}
						disabled={!perspective || !unworked.length}
						title="Analyze and save the {TURNING_POINTS} turning points of {perspective ||
							'the chosen player'} in each game without notes"
						>Analyze all ({unworked.length})</button
					>
				{/if}
				<button onclick={save} disabled={!!batch}>Save all</button>
			</div>
		{/if}
	</div>
{:else if tab === 'saved' && saved.length && !message}
	<p class="muted">No games with notes yet.</p>
{/if}

<style>
	.tabs {
		display: flex;
		gap: 4px;
	}

	.tabs button,
	.outcomes button {
		padding: 4px 12px;
		background: transparent;
	}

	.tabs button.on,
	.outcomes button.on {
		border-color: var(--accent);
		color: var(--accent-2);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.filters input {
		flex: 1;
		min-width: 160px;
	}

	.outcomes {
		display: flex;
		gap: 4px;
	}

	.badge {
		flex: none;
		padding: 2px 7px;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 650;
		color: var(--accent-2);
		background: rgb(227 179 65 / 0.12);
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
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		justify-content: space-between;
	}

	.tab-controls {
		display: flex;
		align-items: center;
		min-height: 42px;
	}

	.loader {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.loader input {
		flex: 1;
		min-width: 140px;
		max-width: 260px;
	}

	.muted {
		color: var(--muted);
		margin: 0;
	}

	.perspective {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.list-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.small {
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}

	.games {
		list-style: none;
		padding: 0;
		margin: 0;
		height: 320px;
		min-height: 80px;
		max-height: fit-content;
		resize: vertical;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: rgb(0 0 0 / 0.18);
	}

	.games button {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		text-align: left;
		border: none;
		border-radius: 0;
	}

	.games li {
		display: flex;
		border-bottom: 1px solid var(--border);
	}

	.games li:last-child {
		border-bottom: none;
	}

	.games .forget {
		flex: none;
		width: auto;
		color: var(--muted);
	}

	.games .forget:not(:disabled):hover {
		color: var(--danger);
	}

	.show-all {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.games button {
		background: transparent;
		padding: 9px 12px;
	}

	.games button:not(:disabled):hover {
		background: rgb(255 255 255 / 0.04);
		transform: none;
	}

	.games button.selected {
		box-shadow: inset 3px 0 0 var(--accent);
		background: rgb(227 179 65 / 0.07);
	}

	.outcome {
		flex: none;
		width: 44px;
		padding: 3px 0;
		border-radius: 6px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		text-transform: uppercase;
	}

	.outcome.win {
		color: var(--good);
		background: rgb(92 201 138 / 0.14);
	}

	.outcome.loss {
		color: var(--danger);
		background: rgb(240 106 106 / 0.14);
	}

	.outcome.draw {
		color: var(--muted);
		background: rgb(255 255 255 / 0.07);
	}

	.players {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.player {
		display: flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.player.winner .name {
		font-weight: 600;
	}

	.player.loser {
		opacity: 0.55;
	}

	.piece {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid var(--border-strong);
	}

	.piece.w {
		background: var(--graph-white);
	}

	.piece.b {
		background: var(--graph-black);
	}

	.rating {
		color: var(--muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.crown {
		color: var(--accent);
		line-height: 1;
	}

	.half {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.meta {
		flex: none;
		color: var(--muted);
		font-size: 0.85rem;
		text-align: right;
	}
</style>
