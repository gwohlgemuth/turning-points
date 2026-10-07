<script lang="ts">
	import { moveLabel } from '#lib/analysis.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let checked = $derived(data.summary.found + data.summary.missed);
	const share = (count: number, total: number) =>
		total ? `${Math.round((count / total) * 100)}% · ` : '';
	const formatDate = (date: number) => (date ? new Date(date).toISOString().slice(0, 10) : '?');
</script>

<svelte:head>
	<title>Stats · Turning Points</title>
</svelte:head>

<main>
	<header>
		<img class="logo" src="/pieces/wN.svg" alt="" />
		<div>
			<h1>Stats</h1>
			<p class="muted small">From the games in ~/{data.folder} and its subfolders</p>
		</div>
		<a class="back" href="/">← Back to analysis</a>
	</header>

	<section class="tiles">
		<div class="card tile">
			<span class="label">Turning points worked on</span>
			<strong>{data.summary.turningPoints}</strong>
			<span class="muted small"
				>in {data.summary.games} {data.summary.games === 1 ? 'game' : 'games'}</span
			>
		</div>
		<div class="card tile found">
			<span class="label">Found</span>
			<strong>{data.summary.found}</strong>
			<span class="muted small"
				>{share(data.summary.found, checked)}Recognition: once you knew it mattered, you found a
				good move</span
			>
		</div>
		<div class="card tile missed">
			<span class="label">Missed</span>
			<strong>{data.summary.missed}</strong>
			<span class="muted small"
				>{share(data.summary.missed, checked)}Finding: even knowing it mattered, no good move</span
			>
		</div>
		<div class="card tile">
			<span class="label">Not checked yet</span>
			<strong>{data.summary.unchecked}</strong>
			<span class="muted small">No candidate move, or not revealed since</span>
		</div>
	</section>

	<section class="card">
		<h2 class="card-title">Turning points</h2>
		{#if !data.entries.length}
			<p class="muted">
				No notes yet. Analyze a game, play your candidate move at a hidden turning point, reveal it
				and save your notes.
			</p>
		{:else}
			<div class="table">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Game</th>
							<th>Move</th>
							<th>Your move</th>
							<th>Result</th>
							<th>File</th>
						</tr>
					</thead>
					<tbody>
						{#each data.entries as entry (`${entry.file}|${entry.date}|${entry.white}|${entry.ply}`)}
							<tr>
								<td class="nowrap">{formatDate(entry.date)}</td>
								<td>{entry.white} – {entry.black}</td>
								<td class="nowrap">{entry.move ? moveLabel(entry.ply, entry.move) : '?'}</td>
								<td>{entry.candidate || '–'}</td>
								<td class="verdict {entry.verdict}">
									{entry.verdict === 'found'
										? '✓ found'
										: entry.verdict === 'missed'
											? '✗ missed'
											: 'not checked'}
								</td>
								<td class="muted small">{entry.file}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
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
		margin-left: auto;
		color: var(--accent-2);
		text-decoration: none;
	}

	.back:hover {
		text-decoration: underline;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.tile {
		display: grid;
		gap: 6px;
		align-content: start;
	}

	.label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.tile strong {
		font-size: 2rem;
		font-variant-numeric: tabular-nums;
	}

	.tile.found strong {
		color: var(--good);
	}

	.tile.missed strong {
		color: var(--danger);
	}

	.table {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th {
		text-align: left;
		font-weight: 600;
		color: var(--muted);
		border-bottom: 1px solid var(--border-strong);
	}

	th,
	td {
		padding: 7px 10px;
	}

	tbody tr + tr td {
		border-top: 1px solid var(--border);
	}

	.nowrap {
		white-space: nowrap;
	}

	.verdict {
		color: var(--muted);
		white-space: nowrap;
	}

	.verdict.found {
		color: var(--good);
	}

	.verdict.missed {
		color: var(--danger);
	}

	.muted {
		color: var(--muted);
	}

	.small {
		font-size: 0.85rem;
	}
</style>
