import { describe, it, expect } from 'vitest';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { bookPlies, inBook } from './index.ts';

const fens = (sans: string[]) => {
	const chess = new Chess();
	return sans.map((san) => chess.move(san).after);
};

describe('bookPlies', () => {
	it('counts the moves until the game leaves the named openings', () => {
		const ruyLopez = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'];
		expect(bookPlies(DEFAULT_POSITION, fens([...ruyLopez, 'h4', 'h5']))).toBe(8);
	});

	it('follows transpositions into the book', () => {
		expect(inBook(fens(['Nf3', 'd5', 'd4']).at(-1)!)).toBe(true);
		const tal = ['e4', 'c6', 'h4', 'd5', 'e5', 'Bf5', 'd4', 'e6', 'a3', 'a6'];
		expect(bookPlies(DEFAULT_POSITION, fens(tal))).toBe(7);
	});

	it('counts a game that never leaves the book in full', () => {
		expect(bookPlies(DEFAULT_POSITION, fens(['e4', 'e5']))).toBe(2);
	});

	it('does not apply to games from another start position', () => {
		expect(bookPlies('8/8/8/8/8/8/4K3/4k3 w - - 0 1', [])).toBeNull();
	});
});
