<script lang="ts">
	type Props = { fen: string; highlight?: string[]; flipped?: boolean };
	type Square = { name: string; piece: string | null; dark: boolean };

	let { fen, highlight = [], flipped = false }: Props = $props();

	const files = 'abcdefgh';

	let squares = $derived.by(() => {
		const result: Square[] = [];
		fen
			.split(' ')[0]
			.split('/')
			.forEach((row, r) => {
				let f = 0;
				for (const ch of row) {
					const empty = Number(ch);
					const count = empty || 1;
					for (let i = 0; i < count; i++, f++) {
						const color = ch === ch.toUpperCase() ? 'w' : 'b';
						result.push({
							name: `${files[f]}${8 - r}`,
							piece: empty ? null : color + ch.toUpperCase(),
							dark: (r + f) % 2 === 1
						});
					}
				}
			});
		return flipped ? result.reverse() : result;
	});
</script>

<div class="board" aria-label="Chess board">
	{#each squares as square, i (square.name)}
		<div class="square" class:dark={square.dark} class:highlight={highlight.includes(square.name)}>
			{#if i % 8 === 0}
				<span class="coord rank">{square.name[1]}</span>
			{/if}
			{#if i >= 56}
				<span class="coord file">{square.name[0]}</span>
			{/if}
			{#if square.piece}
				<img class="piece" src="/pieces/{square.piece}.svg" alt={square.piece} draggable="false" />
			{/if}
		</div>
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		width: 100%;
		max-width: 480px;
		aspect-ratio: 1;
		border: 2px solid var(--board-border);
		container-type: inline-size;
	}

	.square {
		position: relative;
		background: var(--square-light);
		color: var(--square-dark);
	}

	.square.dark {
		background: var(--square-dark);
		color: var(--square-light);
	}

	.square.highlight {
		box-shadow: inset 0 0 0 100vmax rgb(255 214 0 / 0.45);
	}

	.piece {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		user-select: none;
	}

	.coord {
		position: absolute;
		font-size: max(9px, 2.6cqi);
		font-weight: 700;
		line-height: 1;
		user-select: none;
		pointer-events: none;
	}

	.rank {
		top: 3%;
		left: 4%;
	}

	.file {
		bottom: 3%;
		right: 5%;
	}
</style>
