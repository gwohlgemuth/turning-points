<script lang="ts">
	import type { ProgressPoint } from '#lib/profile.ts';

	type Props = { points: ProgressPoint[] };

	let { points }: Props = $props();

	const HEIGHT = 200;
	const PAD = { top: 12, right: 92, bottom: 26, left: 40 };
	const plotHeight = HEIGHT - PAD.top - PAD.bottom;

	let width = $state(600);
	let plotWidth = $derived(Math.max(width - PAD.left - PAD.right, 100));

	const rate = (part: number, whole: number) => (whole ? part / whole : null);

	let hovered = $state<number | null>(null);

	let series = $derived([
		{
			name: 'Missed rate',
			hint: 'lower is better',
			color: '#d95926',
			values: points.map((p) => rate(p.missed, p.checked))
		},
		{
			name: 'Spot rate',
			hint: 'higher is better',
			color: '#3987e5',
			values: points.map((p) => rate(p.spotted, p.spotChecked))
		}
	]);

	const x = (i: number, count: number) =>
		PAD.left + (count > 1 ? (i / (count - 1)) * plotWidth : plotWidth / 2);
	const y = (value: number) => PAD.top + (1 - value) * plotHeight;

	function path(values: (number | null)[]): string {
		let d = '';
		let pen = false;
		values.forEach((value, i) => {
			if (value === null) {
				pen = false;
				return;
			}
			d += `${pen ? 'L' : 'M'}${x(i, values.length)},${y(value)}`;
			pen = true;
		});
		return d;
	}

	function lastValue(values: (number | null)[]) {
		for (let i = values.length - 1; i >= 0; i--) {
			if (values[i] !== null) return { i, value: values[i]! };
		}
		return null;
	}

	const formatLabel = (label: string) =>
		new Date(label.length === 7 ? `${label}-01` : label).toLocaleDateString(undefined, {
			month: 'short',
			...(label.length === 7 ? { year: '2-digit' } : { day: 'numeric' })
		});
	const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);
	const showLabel = (i: number) =>
		points.length <= 8 || i % Math.ceil(points.length / 8) === 0 || i === points.length - 1;
</script>

<div class="chart">
	<div class="legend">
		{#each series as s (s.name)}
			<span><i style:background={s.color}></i>{s.name} <span class="muted">({s.hint})</span></span>
		{/each}
	</div>
	<div class="plot" bind:clientWidth={width}>
		<svg
			viewBox="0 0 {width} {HEIGHT}"
			height={HEIGHT}
			role="img"
			aria-label="Missed rate and spot rate over time"
		>
			{#each [0, 0.5, 1] as tick (tick)}
				<line class="grid" x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} />
				<text class="axis" x={PAD.left - 8} y={y(tick) + 4} text-anchor="end">{tick * 100}%</text>
			{/each}
			{#each points as point, i (point.label)}
				{#if showLabel(i)}
					<text class="axis" x={x(i, points.length)} y={HEIGHT - 6} text-anchor="middle"
						>{formatLabel(point.label)}</text
					>
				{/if}
			{/each}
			{#if hovered !== null}
				<line
					class="crosshair"
					x1={x(hovered, points.length)}
					x2={x(hovered, points.length)}
					y1={PAD.top}
					y2={PAD.top + plotHeight}
				/>
			{/if}
			{#each series as s (s.name)}
				<path d={path(s.values)} stroke={s.color} />
				{#each s.values as value, i (i)}
					{#if value !== null}
						<circle
							cx={x(i, points.length)}
							cy={y(value)}
							r={hovered === i ? 5 : 4}
							fill={s.color}
						/>
					{/if}
				{/each}
				{@const last = lastValue(s.values)}
				{#if last}
					<text class="direct" x={x(last.i, points.length) + 10} y={y(last.value) + 4}
						>{s.name.split(' ')[0]} {percent(last.value)}</text
					>
				{/if}
			{/each}
			{#each points as point, i (point.label)}
				<rect
					role="presentation"
					class="hit"
					x={x(i, points.length) - plotWidth / Math.max(points.length - 1, 1) / 2}
					y={PAD.top}
					width={plotWidth / Math.max(points.length - 1, 1)}
					height={plotHeight}
					onmouseenter={() => (hovered = i)}
					onmouseleave={() => (hovered = null)}
				/>
			{/each}
		</svg>
		{#if hovered !== null}
			{@const point = points[hovered]}
			<div
				class="tooltip"
				style:left="{x(hovered, points.length)}px"
				class:flip={hovered > points.length / 2}
			>
				<strong>{formatLabel(point.label)}</strong>
				<span>{point.games} {point.games === 1 ? 'game' : 'games'}</span>
				{#each series as s (s.name)}
					<span><i style:background={s.color}></i>{s.name}: {percent(s.values[hovered])}</span>
				{/each}
				<span class="muted"
					>{point.missed}/{point.checked} missed · {point.spotted}/{point.spotChecked} spotted</span
				>
			</div>
		{/if}
	</div>
	<details>
		<summary class="muted small">Show as table</summary>
		<table>
			<thead>
				<tr>
					<th>Period</th>
					<th class="num">Games</th>
					<th class="num">Missed</th>
					<th class="num">Spotted</th>
				</tr>
			</thead>
			<tbody>
				{#each points as point (point.label)}
					<tr>
						<td>{formatLabel(point.label)}</td>
						<td class="num">{point.games}</td>
						<td class="num"
							>{percent(rate(point.missed, point.checked))} ({point.missed}/{point.checked})</td
						>
						<td class="num"
							>{percent(rate(point.spotted, point.spotChecked))} ({point.spotted}/{point.spotChecked})</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
</div>

<style>
	.chart {
		display: grid;
		gap: 8px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		font-size: 0.85rem;
	}

	i {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 6px;
	}

	.plot {
		position: relative;
	}

	svg {
		display: block;
		width: 100%;
		overflow: visible;
	}

	.grid {
		stroke: var(--border);
		stroke-width: 1;
	}

	.crosshair {
		stroke: var(--border-strong);
		stroke-width: 1;
	}

	.axis,
	.direct {
		fill: var(--muted);
		font-size: 11px;
	}

	.direct {
		fill: var(--text);
	}

	path {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	circle {
		stroke: var(--surface);
		stroke-width: 2;
	}

	.hit {
		fill: transparent;
	}

	.tooltip {
		position: absolute;
		top: 0;
		transform: translateX(12px);
		display: grid;
		gap: 2px;
		padding: 8px 10px;
		background: var(--surface-3);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		font-size: 0.8rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.tooltip.flip {
		transform: translateX(calc(-100% - 12px));
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	th {
		text-align: left;
		color: var(--muted);
		font-weight: 600;
	}

	th,
	td {
		padding: 4px 8px;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.muted {
		color: var(--muted);
	}

	.small {
		font-size: 0.85rem;
	}
</style>
