<script lang="ts">
	import { moveLabel, type Move } from '#lib/analysis.ts';
	import { describeTime } from '#lib/clock.ts';

	type Props = {
		moves: Move[];
		turningPlies: Set<number>;
		selected: number;
		onselect: (index: number) => void;
	};

	let { moves, turningPlies, selected, onselect }: Props = $props();

	const width = 800;
	const height = 80;
	const mid = height / 2;

	let step = $derived(width / Math.max(1, moves.length));
	let barWidth = $derived(Math.max(1, Math.min(step * 0.7, 10)));
	let maxSpent = $derived(Math.max(1, ...moves.map((m) => m.time?.spent ?? 0)));

	function handleClick(event: MouseEvent) {
		const svg = event.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * width;
		onselect(Math.min(moves.length, Math.max(1, Math.round(x / step))));
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
	viewBox="0 0 {width} {height}"
	preserveAspectRatio="none"
	role="img"
	aria-label="Time spent per move (White above, Black below)"
	onclick={handleClick}
>
	<rect {width} {height} class="bg" />
	<line x1="0" x2={width} y1={mid} y2={mid} class="mid" />
	{#each moves as move (move.ply)}
		{#if move.time}
			{@const barHeight = Math.sqrt(move.time.spent / maxSpent) * (mid - 4)}
			<rect
				x={move.ply * step - barWidth / 2}
				y={move.ply % 2 === 1 ? mid - barHeight : mid}
				width={barWidth}
				height={barHeight}
				class="bar"
				class:turning={turningPlies.has(move.ply)}
				class:selected={selected === move.ply}
			>
				<title>{moveLabel(move.ply, move.san)} · {describeTime(move.time)}</title>
			</rect>
		{/if}
	{/each}
</svg>

<style>
	svg {
		width: 100%;
		height: 50px;
		display: block;
		cursor: pointer;
		border-radius: 10px;
		overflow: hidden;
	}

	.bg {
		fill: rgb(0 0 0 / 0.2);
	}

	.mid {
		stroke: var(--border);
		vector-effect: non-scaling-stroke;
	}

	.bar {
		fill: #5d6577;
	}

	.bar.turning {
		fill: var(--danger);
	}

	.bar.selected {
		fill: var(--accent);
	}
</style>
