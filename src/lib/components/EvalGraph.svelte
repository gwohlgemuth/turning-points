<script lang="ts">
	import {
		formatScore,
		judgeMove,
		moveLabel,
		type Move,
		type PositionEval,
		type TurningPoint
	} from '#lib/analysis.ts';

	type Props = {
		winPercents: number[];
		positions: number;
		moves: Move[];
		evals: PositionEval[];
		turningPoints: TurningPoint[];
		selected: number;
		onselect: (index: number) => void;
	};

	let { winPercents, positions, moves, evals, turningPoints, selected, onselect }: Props = $props();

	const width = 800;
	const height = 160;

	let hovered = $state<number | null>(null);
	let graphWidth = $state(width);

	let step = $derived(width / Math.max(1, positions - 1));
	const y = (wp: number) => height - (wp / 100) * height;
	const left = (index: number) => `${((index * step) / width) * 100}%`;
	const top = (wp: number) => `${(y(wp) / height) * 100}%`;

	let line = $derived(winPercents.map((wp, i) => `${i * step},${y(wp)}`).join(' '));
	let area = $derived(
		winPercents.length ? `0,${height} ${line} ${(winPercents.length - 1) * step},${height}` : ''
	);

	let mistakes = $derived.by(() => {
		const result = [];
		for (let ply = 1; ply < winPercents.length; ply++) {
			const sign = ply % 2 === 1 ? 1 : -1;
			const judgement = judgeMove(sign * (winPercents[ply] - winPercents[ply - 1]));
			if (judgement) result.push({ ply, judgement });
		}
		return result;
	});

	let labelRows = $derived.by(() => {
		const rows: number[] = [];
		turningPoints.forEach((tp, i) => {
			const gap = i ? ((tp.ply - turningPoints[i - 1].ply) * step * graphWidth) / width : Infinity;
			rows.push(gap < 20 && rows[i - 1] === 0 ? 1 : 0);
		});
		return rows;
	});

	let ticks = $derived.by(() => {
		const result = [];
		for (let n = 10; 2 * n - 1 < positions; n += 10) result.push({ n, ply: 2 * n - 1 });
		return result;
	});

	function indexAt(event: MouseEvent): number {
		const svg = event.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * width;
		return Math.min(positions - 1, Math.max(0, Math.round(x / step)));
	}

	function describe(index: number): string {
		const move = index > 0 ? moves[index - 1] : null;
		const label = move ? moveLabel(move.ply, move.san) : 'Start';
		const evaluation = evals[index];
		if (!evaluation) return label;
		return `${label} · ${formatScore(evaluation.score)} · ${evaluation.winPercent.toFixed(0)}%`;
	}
</script>

<div class="graph" bind:clientWidth={graphWidth}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<svg
		viewBox="0 0 {width} {height}"
		preserveAspectRatio="none"
		role="img"
		aria-label="Evaluation graph (winning chances for White)"
		onclick={(event) => onselect(indexAt(event))}
		onmousemove={(event) => (hovered = indexAt(event))}
		onmouseleave={() => (hovered = null)}
	>
		<rect {width} {height} class="bg" />
		<polygon points={area} class="area" />
		<line x1="0" x2={width} y1={height / 2} y2={height / 2} class="mid" />
		{#each ticks as tick (tick.n)}
			<line x1={tick.ply * step} x2={tick.ply * step} y1={height - 6} y2={height} class="tick" />
		{/each}
		<polyline points={line} class="line" />
		{#if hovered !== null}
			<line x1={hovered * step} x2={hovered * step} y1="0" y2={height} class="hover" />
		{/if}
		<line x1={selected * step} x2={selected * step} y1="0" y2={height} class="cursor" />
		{#each turningPoints as tp (tp.ply)}
			<line x1={tp.ply * step} x2={tp.ply * step} y1="0" y2={height} class="tp" />
		{/each}
	</svg>

	{#each ticks as tick (tick.n)}
		<span class="tick-label" style:left={left(tick.ply)}>{tick.n}</span>
	{/each}
	{#each mistakes as { ply, judgement } (ply)}
		<span class="dot {judgement.name}" style:left={left(ply)} style:top={top(winPercents[ply])}
		></span>
	{/each}
	{#each turningPoints as tp, i (tp.ply)}
		<span class="tp-label" style:left={left(tp.ply)} style:top="{3 + labelRows[i] * 19}px"
			>{i + 1}</span
		>
	{/each}
	{#if hovered !== null}
		<div class="tooltip" style:left={left(hovered)} style:transform="translateX(-{left(hovered)})">
			{describe(hovered)}
		</div>
	{/if}
</div>

<style>
	.graph {
		position: relative;
		padding-bottom: 16px;
	}

	svg {
		width: 100%;
		height: 150px;
		cursor: pointer;
		display: block;
		border-radius: 10px;
		overflow: hidden;
	}

	.bg {
		fill: var(--graph-black);
	}

	.area {
		fill: var(--graph-white);
		fill-opacity: 0.82;
	}

	.mid {
		stroke: var(--muted);
		stroke-dasharray: 4 4;
		vector-effect: non-scaling-stroke;
	}

	.tick {
		stroke: var(--muted);
		vector-effect: non-scaling-stroke;
	}

	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.5;
		vector-effect: non-scaling-stroke;
	}

	.hover {
		stroke: #fff;
		stroke-opacity: 0.3;
		vector-effect: non-scaling-stroke;
	}

	.cursor {
		stroke: #fff;
		stroke-opacity: 0.7;
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	.tp {
		stroke: var(--danger);
		stroke-width: 3;
		opacity: 0.7;
		vector-effect: non-scaling-stroke;
	}

	.dot,
	.tick-label,
	.tp-label,
	.tooltip {
		position: absolute;
		pointer-events: none;
		transform: translateX(-50%);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1.5px solid var(--graph-black);
		transform: translate(-50%, -50%);
	}

	.dot.inaccuracy {
		background: #56b4e9;
	}

	.dot.mistake {
		background: #e69f00;
	}

	.dot.blunder {
		background: #df5353;
	}

	.tick-label {
		bottom: 0;
		line-height: 1;
		font-size: 0.7rem;
		color: var(--muted);
	}

	.tp-label {
		min-width: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: var(--danger);
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
	}

	.tooltip {
		top: 24px;
		padding: 3px 8px;
		border-radius: 6px;
		background: rgb(0 0 0 / 0.8);
		color: #fff;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
