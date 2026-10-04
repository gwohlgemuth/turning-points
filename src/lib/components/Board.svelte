<script lang="ts" module>
	export type BoardMove = { from: string; to: string; promotion?: string };
</script>

<script lang="ts">
	import { Chess, type Square as ChessSquare } from 'chess.js';
	import { prefersReducedMotion } from 'svelte/motion';
	import { findSlides, squareOffset, type PieceMap } from '#lib/board-motion.ts';

	type Props = {
		fen: string;
		highlight?: string[];
		flipped?: boolean;
		onmove?: (move: BoardMove) => void;
	};
	type Square = { name: string; piece: string | null; dark: boolean };

	let { fen, highlight = [], flipped = false, onmove }: Props = $props();

	const files = 'abcdefgh';

	let selectedSquare = $state<string | null>(null);
	let promotion = $state<{ from: string; to: string } | null>(null);
	let boardElement: HTMLDivElement;
	let previousPieces: PieceMap | null = null;
	let skipAnimation = false;

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

	let game = $derived(new Chess(fen));
	let legalMoves = $derived(onmove ? game.moves({ verbose: true }) : []);
	let targets = $derived(
		selectedSquare ? legalMoves.filter((m) => m.from === selectedSquare).map((m) => m.to) : []
	);
	let sideToMove = $derived(fen.split(' ')[1] === 'b' ? 'b' : 'w');
	let checkSquare = $derived(
		game.inCheck() ? squares.find((s) => s.piece === `${sideToMove}K`)?.name : undefined
	);
	let pieces = $derived(
		Object.fromEntries(squares.filter((s) => s.piece).map((s) => [s.name, s.piece as string]))
	);

	$effect(() => {
		const next = pieces;
		const previous = previousPieces;
		previousPieces = next;
		const skip = skipAnimation;
		skipAnimation = false;
		if (!previous || skip || prefersReducedMotion.current) return;
		for (const { from, to } of findSlides(previous, next)) {
			const piece = boardElement.querySelector<HTMLElement>(`[data-square="${to}"] .piece`);
			if (!piece) continue;
			const [dx, dy] = squareOffset(from, to, flipped);
			piece.style.zIndex = '2';
			piece.animate(
				[{ transform: `translate(${dx * 100}%, ${dy * 100}%)` }, { transform: 'none' }],
				{ duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
			).onfinish = () => piece.style.removeProperty('z-index');
		}
	});

	$effect(() => {
		void fen;
		selectedSquare = null;
		promotion = null;
	});

	const canMoveFrom = (square: string) => legalMoves.some((m) => m.from === square);

	function tryMove(from: string, to: string, dragged = false) {
		const candidates = legalMoves.filter((m) => m.from === from && m.to === to);
		selectedSquare = null;
		if (!candidates.length) return;
		skipAnimation = dragged;
		if (candidates.some((m) => m.promotion)) {
			promotion = { from, to };
			return;
		}
		onmove?.({ from, to });
	}

	function handleClick(square: string) {
		if (!onmove) return;
		if (selectedSquare && targets.includes(square as ChessSquare)) {
			tryMove(selectedSquare, square);
		} else {
			selectedSquare = canMoveFrom(square) && selectedSquare !== square ? square : null;
		}
	}

	function handleDragStart(event: DragEvent, square: string) {
		selectedSquare = square;
		event.dataTransfer?.setData('text/plain', square);
	}

	function handleDrop(event: DragEvent, square: string) {
		event.preventDefault();
		const from = event.dataTransfer?.getData('text/plain');
		if (from && from !== square) tryMove(from, square, true);
	}

	function promote(piece: string) {
		if (promotion) onmove?.({ ...promotion, promotion: piece });
		promotion = null;
	}
</script>

<div class="board" class:interactive={!!onmove} aria-label="Chess board" bind:this={boardElement}>
	{#each squares as square, i (square.name)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="square"
			data-square={square.name}
			class:dark={square.dark}
			class:check={checkSquare === square.name}
			class:highlight={highlight.includes(square.name)}
			class:selected={selectedSquare === square.name}
			class:target={targets.includes(square.name as ChessSquare)}
			class:occupied={!!square.piece}
			onclick={() => handleClick(square.name)}
			ondragover={(event) => event.preventDefault()}
			ondrop={(event) => handleDrop(event, square.name)}
		>
			{#if i % 8 === 0}
				<span class="coord rank">{square.name[1]}</span>
			{/if}
			{#if i >= 56}
				<span class="coord file">{square.name[0]}</span>
			{/if}
			{#if square.piece}
				<img
					class="piece"
					src="/pieces/{square.piece}.svg"
					alt={square.piece}
					draggable={canMoveFrom(square.name)}
					ondragstart={(event) => handleDragStart(event, square.name)}
				/>
			{/if}
		</div>
	{/each}

	{#if promotion}
		<div class="promotion" role="dialog" aria-label="Choose promotion piece">
			{#each ['q', 'r', 'b', 'n'] as piece (piece)}
				<button onclick={() => promote(piece)}>
					<img src="/pieces/{sideToMove}{piece.toUpperCase()}.svg" alt={piece} />
				</button>
			{/each}
			<button class="cancel" onclick={() => (promotion = null)} aria-label="Cancel">✕</button>
		</div>
	{/if}
</div>

<style>
	.board {
		position: relative;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		width: 100%;
		max-width: 480px;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.4),
			0 16px 40px rgb(0 0 0 / 0.45);
		container-type: inline-size;
	}

	.square {
		position: relative;
		background: var(--square-light, #f0d9b5);
		color: var(--square-dark, #b58863);
		transition: box-shadow 0.15s ease;
	}

	.square.dark {
		background: var(--square-dark, #b58863);
		color: var(--square-light, #f0d9b5);
	}

	.square.highlight {
		box-shadow: inset 0 0 0 100vmax rgb(155 199 0 / 0.42);
	}

	.square.selected {
		box-shadow: inset 0 0 0 100vmax rgb(20 85 30 / 0.5);
	}

	.square.check {
		background-image: radial-gradient(
			circle,
			rgb(255 40 40 / 0.95) 0%,
			rgb(230 0 0 / 0.55) 35%,
			transparent 72%
		);
	}

	.square.target::after {
		animation: pop 0.15s ease-out;
		content: '';
		position: absolute;
		inset: 36%;
		border-radius: 50%;
		background: rgb(20 85 30 / 0.45);
		pointer-events: none;
	}

	.square.target.occupied::after {
		inset: 3%;
		background: none;
		border: 4px solid rgb(20 85 30 / 0.45);
	}

	@keyframes pop {
		from {
			transform: scale(0.3);
			opacity: 0;
		}
	}

	.interactive .square {
		cursor: pointer;
	}

	.piece {
		position: absolute;
		z-index: 1;
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

	.promotion {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: rgb(0 0 0 / 0.45);
	}

	.promotion button {
		width: 14%;
		aspect-ratio: 1;
		padding: 4px;
		background: var(--square-light, #f0d9b5);
	}

	.promotion img {
		width: 100%;
		height: 100%;
	}

	.promotion .cancel {
		width: auto;
		aspect-ratio: auto;
	}
</style>
