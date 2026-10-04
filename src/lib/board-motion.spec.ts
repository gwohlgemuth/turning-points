import { describe, it, expect } from 'vitest';
import { findSlides, squareOffset } from './board-motion.ts';

const start = { e1: 'wK', h1: 'wR', e2: 'wP', e8: 'bK', d7: 'bP' };

describe('findSlides', () => {
	it('finds a simple move in both directions', () => {
		const after = { ...start, e4: 'wP' } as Record<string, string>;
		delete after.e2;
		expect(findSlides(start, after)).toEqual([{ from: 'e2', to: 'e4' }]);
		expect(findSlides(after, start)).toEqual([{ from: 'e4', to: 'e2' }]);
	});

	it('finds a capture', () => {
		const before = { a1: 'wR', a8: 'bR' };
		expect(findSlides(before, { a8: 'wR' })).toEqual([{ from: 'a1', to: 'a8' }]);
	});

	it('finds king and rook when castling', () => {
		const after = { e2: 'wP', g1: 'wK', f1: 'wR', e8: 'bK', d7: 'bP' };
		expect(findSlides(start, after)).toEqual(
			expect.arrayContaining([
				{ from: 'e1', to: 'g1' },
				{ from: 'h1', to: 'f1' }
			])
		);
	});

	it('does not slide a promoted piece and ignores jumps over many moves', () => {
		expect(findSlides({ a7: 'wP' }, { a8: 'wQ' })).toEqual([]);
		const far = { a1: 'wK', b1: 'wQ', c1: 'wR', d1: 'wB', e1: 'wN' };
		expect(findSlides(start, far)).toEqual([]);
	});
});

describe('squareOffset', () => {
	it('returns the screen offset in squares, also on a flipped board', () => {
		expect(squareOffset('e2', 'e4', false)).toEqual([0, 2]);
		expect(squareOffset('g1', 'f3', false)).toEqual([1, 2]);
		expect(squareOffset('g1', 'f3', true)).toEqual([-1, -2]);
	});
});
