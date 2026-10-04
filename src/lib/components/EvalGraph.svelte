<script lang="ts">
	import type { TurningPoint } from '#lib/analysis.ts';

	type Props = {
		winPercents: number[];
		positions: number;
		turningPoints: TurningPoint[];
		selected: number;
		onselect: (index: number) => void;
	};

	let { winPercents, positions, turningPoints, selected, onselect }: Props = $props();

	const width = 800;
	const height = 160;

	let step = $derived(width / Math.max(1, positions - 1));
	const y = (wp: number) => height - (wp / 100) * height;

	let line = $derived(winPercents.map((wp, i) => `${i * step},${y(wp)}`).join(' '));
	let area = $derived(
		winPercents.length ? `0,${height} ${line} ${(winPercents.length - 1) * step},${height}` : ''
	);

	function handleClick(event: MouseEvent) {
		const svg = event.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * width;
		onselect(Math.min(positions - 1, Math.max(0, Math.round(x / step))));
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="none"
	role="img"
	aria-label="Evaluation graph (winning chances for White)"
	onclick={handleClick}
>
	<rect {width} {height} class="bg" />
	<polygon points={area} class="area" />
	<line x1="0" x2={width} y1={height / 2} y2={height / 2} class="mid" />
	<polyline points={line} class="line" />
	<line x1={selected * step} x2={selected * step} y1="0" y2={height} class="cursor" />
	{#each turningPoints as tp (tp.ply)}
		<line x1={tp.ply * step} x2={tp.ply * step} y1="0" y2={height} class="tp" />
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: 140px;
		cursor: pointer;
		display: block;
		border-radius: 6px;
		overflow: hidden;
	}

	.bg {
		fill: var(--graph-black);
	}

	.area {
		fill: var(--graph-white);
	}

	.mid {
		stroke: var(--muted);
		stroke-dasharray: 4 4;
		vector-effect: non-scaling-stroke;
	}

	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	.cursor {
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}

	.tp {
		stroke: var(--danger);
		stroke-width: 3;
		opacity: 0.7;
		vector-effect: non-scaling-stroke;
	}
</style>
