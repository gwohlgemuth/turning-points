<script lang="ts">
	type Props = { fen: string; highlight?: string[]; flipped?: boolean };
	type Square = { name: string; piece: string | null; whitePiece: boolean; dark: boolean };

	let { fen, highlight = [], flipped = false }: Props = $props();

	const glyphs: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
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
						result.push({
							name: `${files[f]}${8 - r}`,
							piece: empty ? null : glyphs[ch.toLowerCase()] + '︎',
							whitePiece: ch === ch.toUpperCase(),
							dark: (r + f) % 2 === 1
						});
					}
				}
			});
		return flipped ? result.reverse() : result;
	});
</script>

<div class="board" aria-label="Chess board">
	{#each squares as square (square.name)}
		<div
			class="square"
			class:dark={square.dark}
			class:highlight={highlight.includes(square.name)}
			title={square.name}
		>
			{#if square.piece}
				<span class="piece" class:white={square.whitePiece}>{square.piece}</span>
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
		display: grid;
		place-items: center;
		background: var(--square-light);
	}

	.square.dark {
		background: var(--square-dark);
	}

	.square.highlight {
		box-shadow: inset 0 0 0 100vmax rgb(255 214 0 / 0.45);
	}

	.piece {
		font-size: 10cqi;
		line-height: 1;
		color: #111;
		user-select: none;
	}

	.piece.white {
		color: #fff;
		text-shadow:
			0 0 1px #000,
			0 0 1px #000,
			0 0 2px #000;
	}
</style>
