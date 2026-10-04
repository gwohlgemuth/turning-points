<script lang="ts">
	import Board from '#lib/components/Board.svelte';
	import EvalGraph from '#lib/components/EvalGraph.svelte';
	import {
		findTurningPoints,
		formatScore,
		moveLabel,
		type AnalyzeEvent,
		type Move,
		type PositionEval
	} from '#lib/analysis.ts';

	let pgn = $state('');
	let count = $state(3);
	let depth = $state(16);

	let status = $state<'idle' | 'running' | 'done' | 'error'>('idle');
	let message = $state('');
	let startFen = $state('');
	let moves = $state<Move[]>([]);
	let headers = $state<Record<string, string>>({});
	let evals = $state<PositionEval[]>([]);
	let selected = $state(0);
	let flipped = $state(false);
	let controller: AbortController | null = null;

	let positions = $derived(moves.length + 1);
	let winPercents = $derived.by(() => {
		const result: number[] = [];
		for (const e of evals) {
			if (!e) break;
			result.push(e.winPercent);
		}
		return result;
	});
	let turningPoints = $derived(findTurningPoints(winPercents, count));
	let turningPlies = $derived(new Set(turningPoints.map((tp) => tp.ply)));
	let fen = $derived(selected === 0 ? startFen : (moves[selected - 1]?.fenAfter ?? startFen));
	let lastMove = $derived(selected > 0 ? moves[selected - 1] : null);
	let progress = $derived(positions > 0 ? Math.round((winPercents.length / positions) * 100) : 0);

	function handleEvent(event: AnalyzeEvent) {
		if (event.type === 'start') {
			startFen = event.startFen;
			moves = event.moves;
			headers = event.headers;
			evals = [];
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
		selected = Math.min(positions - 1, Math.max(0, index));
	}

	function handleKey(event: KeyboardEvent) {
		if (!moves.length || (event.target as HTMLElement).tagName === 'TEXTAREA') return;
		if (event.key === 'ArrowLeft') select(selected - 1);
		if (event.key === 'ArrowRight') select(selected + 1);
	}

	async function loadFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) pgn = await file.text();
	}
</script>

<svelte:window onkeydown={handleKey} />

<main>
	<header>
		<h1>Turning Points</h1>
		<p class="lead">
			Find the moments where your game turned — the moves where the evaluation swung the most. Study
			those positions first, before looking at the engine (after GM Noël Studer).
		</p>
	</header>

	<section class="input">
		<textarea bind:value={pgn} rows="8" placeholder="Paste a PGN here…"></textarea>
		<div class="controls">
			<label>
				PGN file
				<input type="file" accept=".pgn,text/plain" onchange={loadFile} />
			</label>
			<label>
				Turning points <strong>{count}</strong>
				<input type="range" min="1" max="10" bind:value={count} />
			</label>
			<label>
				Depth
				<input type="number" min="6" max="30" bind:value={depth} />
			</label>
			{#if status === 'running'}
				<button onclick={stop}>Stop</button>
			{:else}
				<button class="primary" onclick={analyze} disabled={!pgn.trim()}>Analyze</button>
			{/if}
		</div>
		{#if status === 'running'}
			<progress max="100" value={progress}></progress>
			<span class="muted">Analyzing… {winPercents.length}/{positions}</span>
		{/if}
		{#if status === 'error'}
			<p class="error">{message}</p>
		{/if}
	</section>

	{#if moves.length}
		{#if headers.White || headers.Black}
			<p class="players">
				{headers.White ?? '?'} – {headers.Black ?? '?'}
				{#if headers.Result}<span class="muted">({headers.Result})</span>{/if}
			</p>
		{/if}

		<EvalGraph {winPercents} {positions} {turningPoints} {selected} onselect={select} />

		<div class="layout">
			<section class="board-panel">
				<Board {fen} {flipped} highlight={lastMove ? [lastMove.from, lastMove.to] : []} />
				<div class="nav">
					<button onclick={() => select(0)} aria-label="Start">⏮</button>
					<button onclick={() => select(selected - 1)} aria-label="Previous">◀</button>
					<button onclick={() => select(selected + 1)} aria-label="Next">▶</button>
					<button onclick={() => select(positions - 1)} aria-label="End">⏭</button>
					<button onclick={() => (flipped = !flipped)}>Flip</button>
				</div>
				<p class="muted">
					{lastMove ? moveLabel(lastMove.ply, lastMove.san) : 'Start position'}
					{#if evals[selected]}· {formatScore(evals[selected].score)}{/if}
				</p>
			</section>

			<section class="points">
				<h2>Turning points</h2>
				{#if !turningPoints.length}
					<p class="muted">Waiting for the engine…</p>
				{/if}
				<ol>
					{#each turningPoints as tp (tp.ply)}
						{@const move = moves[tp.ply - 1]}
						{@const before = evals[tp.ply - 1]}
						{@const after = evals[tp.ply]}
						<li class:active={selected === tp.ply - 1 || selected === tp.ply}>
							<div class="tp-head">
								<button class="link" onclick={() => select(tp.ply - 1)}>
									{moveLabel(tp.ply, move.san)}
								</button>
								<span class="delta" class:good={tp.delta > 0}>
									{tp.delta > 0 ? '+' : ''}{tp.delta.toFixed(1)}%
								</span>
							</div>
							<div class="muted">
								{formatScore(before.score)} → {formatScore(after.score)}
							</div>
							<div class="tp-actions">
								<button onclick={() => select(tp.ply - 1)}>Position before</button>
								<button onclick={() => select(tp.ply)}>After</button>
							</div>
							<details>
								<summary>Engine suggestion</summary>
								{#if before.bestMove}
									<p>
										Best: <strong>{before.bestMove}</strong>
										<span class="muted">{before.pv.join(' ')}</span>
									</p>
								{/if}
							</details>
						</li>
					{/each}
				</ol>

				<h2>Moves</h2>
				<div class="moves">
					{#each moves as move (move.ply)}
						<button
							class="move"
							class:current={selected === move.ply}
							class:turning={turningPlies.has(move.ply)}
							onclick={() => select(move.ply)}
						>
							{move.ply % 2 === 1 ? `${(move.ply + 1) / 2}.` : ''}{move.san}
						</button>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px 16px 64px;
		display: grid;
		gap: 20px;
	}

	h1 {
		margin: 0;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}

	.lead {
		color: var(--muted);
		margin: 4px 0 0;
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		font-family: ui-monospace, monospace;
	}

	.input {
		display: grid;
		gap: 10px;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: end;
	}

	.controls label {
		display: grid;
		gap: 4px;
		font-size: 0.9rem;
	}

	.controls input[type='number'] {
		width: 5em;
	}

	progress {
		width: 100%;
	}

	.players {
		font-weight: 600;
		margin: 0;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 480px) minmax(0, 1fr);
		gap: 24px;
	}

	@media (max-width: 760px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.nav {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}

	ol {
		padding: 0;
		margin: 0 0 24px;
		list-style: none;
		display: grid;
		gap: 10px;
	}

	li {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 10px 12px;
		background: var(--surface);
	}

	li.active {
		border-color: var(--accent);
	}

	.tp-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.delta {
		font-weight: 700;
		color: var(--danger);
	}

	.delta.good {
		color: var(--good);
	}

	.tp-actions {
		display: flex;
		gap: 6px;
		margin: 8px 0;
	}

	details p {
		margin: 6px 0 0;
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

	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.move {
		padding: 2px 6px;
		font-size: 0.9rem;
	}

	.move.turning {
		border-color: var(--danger);
		color: var(--danger);
	}

	.move.current {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
</style>
