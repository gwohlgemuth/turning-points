<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import backend from '#backend';
	import Header from '#lib/components/Header.svelte';
	import { moveLabel } from '#lib/analysis.ts';
	import { statsView } from '#lib/backend/shared.ts';
	import type { Speed } from '#lib/clock.ts';
	import { today } from '#lib/games.ts';
	import Board from '#lib/components/Board.svelte';
	import ProgressChart from '#lib/components/ProgressChart.svelte';
	import type { Group } from '#lib/profile.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const SPEEDS: { value: Speed; label: string }[] = [
		{ value: 'bullet', label: 'Bullet' },
		{ value: 'blitz', label: 'Blitz' },
		{ value: 'rapid', label: 'Rapid' },
		{ value: 'classical', label: 'Classical' }
	];
	let speed = $state<Speed | null>(null);
	let speeds = $derived(SPEEDS.filter(({ value }) => data.entries.some((e) => e.speed === value)));
	let entries = $derived(
		speed ? data.entries.filter((entry) => entry.speed === speed) : data.entries
	);
	let view = $derived(statsView(entries));

	let checked = $derived(view.summary.found + view.summary.missed);
	const share = (count: number, total: number) =>
		total ? `${Math.round((count / total) * 100)}% · ` : '';
	const formatDate = (date: number) => (date ? new Date(date).toISOString().slice(0, 10) : '?');
	const missRate = (row: Group) => row.missed / (row.found + row.missed || 1);

	let weakest = $derived.by(() => {
		const rows = [...view.profile.phase, ...view.profile.time, ...view.profile.kind];
		const checkedRows = rows.filter((row) => row.found + row.missed > 0);
		return checkedRows.reduce<Group | null>(
			(worst, row) => (!worst || missRate(row) > missRate(worst) ? row : worst),
			null
		);
	});
	let profileGroups = $derived([
		{ title: 'Phase', rows: view.profile.phase },
		{ title: 'Time', rows: view.profile.time },
		{ title: 'Kind', rows: view.profile.kind },
		{ title: 'Confidence', rows: view.profile.confidence },
		{ title: 'Cause', rows: view.profile.cause }
	]);
	let sureMissed = $derived(
		view.profile.confidence.find((row) => row.label === 'Sure')?.missed ?? 0
	);

	let libraryMessage = $state('');
	let fileInput = $state<HTMLInputElement>();

	async function exportGames() {
		const text = await backend.exportPgn!();
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }));
		link.download = `turning-points-${today()}.pgn`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	async function deleteAll() {
		if (!confirm('Delete all saved games and review progress? Export them first to keep them.'))
			return;
		try {
			await backend.deleteAll!();
			libraryMessage = 'Deleted all games';
			await invalidateAll();
		} catch (err) {
			libraryMessage = (err as Error).message;
		}
	}

	async function importGames(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const count = await backend.importPgn!(await file.text());
			libraryMessage = `Imported ${count} ${count === 1 ? 'game' : 'games'}`;
			await invalidateAll();
		} catch (err) {
			libraryMessage = (err as Error).message;
		} finally {
			input.value = '';
		}
	}
</script>

<svelte:head>
	<title>Stats · Turning Points</title>
</svelte:head>

<main>
	<Header />

	<div class="page-head">
		<h1>Stats</h1>
		<p class="muted small">
			From the games in {backend.describe(data.folder)}{backend.listFolders
				? ' and its subfolders'
				: ''}
		</p>
		{#if backend.exportPgn && backend.importPgn}
			<div class="library">
				<button onclick={exportGames}>Export all as PGN</button>
				<button onclick={() => fileInput?.click()}>Import PGN</button>
				{#if backend.deleteAll}<button onclick={deleteAll}>Delete all</button>{/if}
				<input
					bind:this={fileInput}
					type="file"
					accept=".pgn,text/plain"
					onchange={importGames}
					aria-label="Import PGN file"
					hidden
				/>
				{#if libraryMessage}<span class="muted small">{libraryMessage}</span>{/if}
			</div>
		{/if}
	</div>

	{#if speeds.length > 1}
		<div class="speeds" role="group" aria-label="Time control">
			<button class:on={!speed} onclick={() => (speed = null)}>All</button>
			{#each speeds as { value, label } (value)}
				<button class:on={speed === value} onclick={() => (speed = value)}>{label}</button>
			{/each}
		</div>
	{/if}

	<section class="tiles">
		<div class="card tile">
			<span class="label">Turning points</span>
			<strong>{view.summary.turningPoints}</strong>
			<span class="muted small"
				>{view.summary.worked} worked on · in {view.summary.games}
				{view.summary.games === 1 ? 'game' : 'games'}</span
			>
		</div>
		<div class="card tile found">
			<span class="label">Found</span>
			<strong>{view.summary.found}</strong>
			<span class="muted small"
				>{share(view.summary.found, checked)}Recognition: once you knew it mattered, you found a
				good move</span
			>
		</div>
		<div class="card tile missed">
			<span class="label">Missed</span>
			<strong>{view.summary.missed}</strong>
			<span class="muted small"
				>{share(view.summary.missed, checked)}Finding: even knowing it mattered, no good move</span
			>
		</div>
		<div class="card tile">
			<span class="label">Not checked yet</span>
			<strong>{view.summary.unchecked}</strong>
			<span
				class="muted small term"
				title="Includes turning points marked by Analyze all that you have not opened yet"
				>Not worked on yet, or no candidate move</span
			>
		</div>
	</section>

	{#if entries.length}
		<section class="card">
			<h2 class="card-title">Progress</h2>
			{#if view.progress.length >= 2}
				<ProgressChart points={view.progress} />
			{:else}
				<p class="muted">Come back after more weeks of games to see your progress.</p>
			{/if}
		</section>

		<section class="card">
			<h2 class="card-title">Error profile</h2>
			{#if weakest?.missed}
				<p class="muted small">
					Most missed: <strong class="missed-text">{weakest.label}</strong> ({Math.round(
						missRate(weakest) * 100
					)}% of checked turning points missed)
				</p>
			{/if}
			<div class="profile">
				{#each profileGroups as { title, rows } (title)}
					{#if rows.length}
						<table>
							<thead>
								<tr>
									<th>{title}</th>
									<th class="num">Total</th>
									<th class="num">Found</th>
									<th class="num">Missed</th>
								</tr>
							</thead>
							<tbody>
								{#each rows as row (row.label)}
									<tr class:weakest={row === weakest && row.missed > 0}>
										<td><span class="term" title={row.hint}>{row.label}</span></td>
										<td class="num">{row.total}</td>
										<td class="num verdict found">{row.found}</td>
										<td class="num verdict missed">{row.missed}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				{/each}
			</div>
			{#if sureMissed}
				<p class="muted small">
					Sure but missed: <strong class="missed-text">{sureMissed}</strong>. These are the
					positions where your judgment misled you, so they are the most worth reviewing.
				</p>
			{/if}
		</section>

		<section class="card">
			<h2 class="card-title">Your rules</h2>
			{#if view.rules.length}
				<p class="muted small">
					Your “When …, then …” rules, grouped by what went wrong. Read them before you play.
				</p>
				{#each view.rules as section (section.label)}
					<h3 class="label">{section.label} · {section.rules.length}</h3>
					<ul class="rules">
						{#each section.rules as rule (`${rule.file}|${rule.date}|${rule.white}|${rule.ply}`)}
							<li>
								<span>{rule.lesson}</span>
								<span class="muted small nowrap"
									>{moveLabel(rule.ply, rule.move)} · {rule.white} – {rule.black} · {formatDate(
										rule.date
									)}</span
								>
							</li>
						{/each}
					</ul>
				{/each}
			{:else}
				<p class="muted">
					No rules yet. After revealing a turning point, write one rule for next time.
				</p>
			{/if}
		</section>

		<section class="card">
			<h2 class="card-title">Opening leaks</h2>
			{#if view.leaks.length}
				<div class="table">
					<table>
						<thead>
							<tr>
								<th>Opening</th>
								<th class="num">Games</th>
								<th class="num">
									<span class="term" title="Turning points in the first 30 plies of your games"
										>Turning points by move 15</span
									>
								</th>
								<th class="num">
									<span
										class="term"
										title="Turning points on your first move or the move after it out of book: learn the line further"
										>Leaving book</span
									>
								</th>
								<th class="num">
									<span
										class="term"
										title="Turning points in the five moves after that: learn the typical plans"
										>Soon after</span
									>
								</th>
								<th class="num">Missed</th>
							</tr>
						</thead>
						<tbody>
							{#each view.leaks as leak (leak.opening)}
								<tr>
									<td>{leak.opening}</td>
									<td class="num">{leak.games}</td>
									<td class="num">{leak.turningPoints}</td>
									<td class="num">{leak.leavingBook}</td>
									<td class="num">{leak.soonAfterBook}</td>
									<td class="num verdict missed">{leak.missed}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="muted">No turning points in the first 15 moves yet.</p>
			{/if}
			{#if view.repeated.length}
				<h3 class="label">Positions that turned in several games</h3>
				<div class="table">
					<table>
						<thead>
							<tr>
								<th>Position</th>
								<th>Moves played</th>
								<th class="num">Games</th>
								<th class="num">Missed</th>
							</tr>
						</thead>
						<tbody>
							{#each view.repeated as row (row.fen)}
								<tr>
									<td
										><div class="mini"><Board fen={row.fen} flipped={row.ply % 2 === 0} /></div></td
									>
									<td class="nowrap">
										{row.moves.map((move) => moveLabel(row.ply, move)).join(', ')}
										<a
											class="explorer small"
											href="https://lichess.org/analysis/{row.fen.replaceAll(' ', '_')}"
											target="_blank"
											rel="noopener noreferrer"
											title="Look the position up in the Lichess opening explorer">Explorer ↗</a
										>
									</td>
									<td class="num">{row.games}</td>
									<td class="num verdict missed">{row.missed}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}

	<section class="card">
		<h2 class="card-title">Turning points</h2>
		{#if !entries.length}
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
						{#each entries as entry (`${entry.file}|${entry.date}|${entry.white}|${entry.ply}`)}
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

	.page-head h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
	}

	.page-head p {
		margin: 2px 0 0;
	}

	.library {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}

	.speeds {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.speeds button {
		padding: 4px 12px;
		font-size: 0.85rem;
	}

	.speeds button.on {
		border-color: var(--accent);
		color: var(--accent-2);
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

	.profile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 16px;
		margin: 10px 0;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	tr.weakest td {
		background: rgb(255 255 255 / 0.04);
		font-weight: 600;
	}

	.missed-text {
		color: var(--danger);
	}

	h3.label {
		margin: 18px 0 6px;
	}

	.rules {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.rules li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 16px;
		padding: 7px 0;
	}

	.rules li + li {
		border-top: 1px solid var(--border);
	}

	.term {
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		cursor: help;
	}

	.explorer {
		display: block;
		margin-top: 4px;
	}

	.mini {
		width: 140px;
	}

	.muted {
		color: var(--muted);
	}

	.small {
		font-size: 0.85rem;
	}
</style>
