<script lang="ts">
	import { onMount } from 'svelte';
	import type { Side } from '#lib/analysis.ts';
	import {
		GAME_COUNTS,
		gamesToPgn,
		playerSide,
		today,
		type GameSource,
		type GameSummary
	} from '#lib/games.ts';
	import { downloadText } from '#lib/download.ts';

	type Props = {
		onselect: (game: GameSummary, side: Side | null) => void;
		games?: GameSummary[];
	};

	let { onselect, games = $bindable([]) }: Props = $props();

	const STORAGE_KEY = 'turning-points:account';

	let source = $state<GameSource>('lichess');
	let username = $state('');
	let max = $state(20);
	let loading = $state(false);
	let message = $state('');
	let selectedId = $state('');

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
			if (saved) ({ source, username, max = 20 } = saved);
		} catch {
			// storage unavailable
		}
	});

	async function load(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		message = '';
		games = [];
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ source, username, max }));
		} catch {
			// storage unavailable
		}
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
		downloadText(gamesToPgn(games), `${username.trim() || 'games'}-${today()}.pgn`);
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
	<ul class="games">
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
		border-radius: 6px;
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

	.games button:hover {
		background: var(--bg);
	}

	.games button.selected {
		box-shadow: inset 3px 0 0 var(--accent);
	}

	.meta {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
