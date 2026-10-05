<script lang="ts">
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { ms } from '#lib/motion.ts';
	import type { Side } from '#lib/analysis.ts';
	import {
		GAME_COUNTS,
		gamesToPgn,
		playerSide,
		playersByCount,
		today,
		winner,
		type GameSource,
		type GameSummary
	} from '#lib/games.ts';
	import { savePgn } from '#lib/saving.svelte.ts';
	import { updatePreferences, type Preferences } from '#lib/preferences.ts';

	type Props = {
		onselect: (game: GameSummary, side: Side) => void;
		games?: GameSummary[];
		preferences: Preferences;
	};

	let { onselect, games = $bindable([]), preferences }: Props = $props();

	const initial = untrack(() => preferences);
	let source = $state<GameSource>(initial.source);
	let username = $state(initial.username);
	let max = $state(initial.max);
	let loading = $state(false);
	let message = $state('');
	let selectedId = $state('');
	let loadedUser = $state(initial.username);
	const players = $derived(playersByCount(games));
	let perspective = $derived(
		players.find((name) => name.toLowerCase() === loadedUser.toLowerCase()) ?? players[0] ?? ''
	);

	async function load(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		message = '';
		games = [];
		loadedUser = username.trim();
		updatePreferences({ source, username: username.trim(), max });
		try {
			const params = new URLSearchParams({ source, user: username.trim(), max: String(max) });
			const response = await fetch(`/api/games?${params}`);
			const body = await response.json();
			if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
			games = body.games;
			if (!games.length) message = 'No games found';
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

	function save() {
		savePgn(gamesToPgn(games), `${username.trim() || 'games'}-${today()}.pgn`);
	}

	const OUTCOME_LABELS = { win: 'Win', loss: 'Loss', draw: 'Draw' };

	function outcome(game: GameSummary) {
		const won = winner(game.result);
		const side = playerSide(game, perspective);
		if (!won || !side) return null;
		if (won === 'draw') return 'draw';
		return won === side ? 'win' : 'loss';
	}
	const formatDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString() : '');
</script>

<form class="loader" onsubmit={load}>
	<select bind:value={source} aria-label="Source">
		<option value="lichess">Lichess</option>
		<option value="chesscom">Chess.com</option>
	</select>
	<input bind:value={username} placeholder="Username" aria-label="Username" required />
	<select bind:value={max} aria-label="Number of games">
		{#each GAME_COUNTS as count (count)}
			<option value={count}>{count} games</option>
		{/each}
	</select>
	<button type="submit" disabled={loading || !username.trim()}>
		{loading ? 'Loading…' : 'Load games'}
	</button>
</form>

{#if message}
	<p class="muted">{message}</p>
{/if}

{#if games.length}
	<label class="perspective">
		<span class="muted">View as</span>
		<select bind:value={perspective}>
			<option value="">Neutral</option>
			{#each players as name (name)}
				<option value={name}>{name}</option>
			{/each}
		</select>
	</label>
	<ul class="games" transition:slide={{ duration: ms(200) }}>
		{#each games as game (game.id)}
			{@const won = winner(game.result)}
			{@const mine = outcome(game)}
			<li>
				<button class:selected={selectedId === game.id} onclick={() => choose(game)}>
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
					<span class="meta">
						{[game.timeClass, formatDate(game.date)].filter(Boolean).join(' · ')}
					</span>
				</button>
			</li>
		{/each}
	</ul>
	<div class="list-footer">
		<span class="muted">{games.length} games</span>
		<button onclick={save}>Save as PGN</button>
	</div>
{/if}

<style>
	.loader {
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

	.games {
		list-style: none;
		padding: 0;
		margin: 0;
		max-height: 320px;
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
		border-bottom: 1px solid var(--border);
		border-radius: 0;
	}

	.games li:last-child button {
		border-bottom: none;
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
