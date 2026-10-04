<script lang="ts">
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { ms } from '#lib/motion.ts';
	import type { Side } from '#lib/analysis.ts';
	import {
		GAME_COUNTS,
		gamesToPgn,
		playerSide,
		today,
		type GameSource,
		type GameSummary
	} from '#lib/games.ts';
	import { savePgn } from '#lib/saving.svelte.ts';
	import { updatePreferences, type Preferences } from '#lib/preferences.ts';

	type Props = {
		onselect: (game: GameSummary, side: Side | null) => void;
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

	async function load(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		message = '';
		games = [];
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
		onselect(game, playerSide(game, username));
	}

	function save() {
		savePgn(gamesToPgn(games), `${username.trim() || 'games'}-${today()}.pgn`);
	}

	const player = (name: string, rating: number | null) => (rating ? `${name} (${rating})` : name);
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
	<ul class="games" transition:slide={{ duration: ms(200) }}>
		{#each games as game (game.id)}
			<li>
				<button class:selected={selectedId === game.id} onclick={() => choose(game)}>
					<span class="players">
						{player(game.white, game.whiteRating)} – {player(game.black, game.blackRating)}
					</span>
					<span class="meta">
						<strong>{game.result}</strong>
						{#each [game.timeClass, formatDate(game.date)].filter(Boolean) as part (part)}
							· {part}
						{/each}
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
		max-height: 260px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: rgb(0 0 0 / 0.18);
	}

	.games button {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
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

	.meta {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
