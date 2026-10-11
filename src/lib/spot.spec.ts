import { describe, it, expect } from 'vitest';
import { emptyNotes, readNotes, writeNotes } from './notes.ts';
import { isSpotted, readSpotFlags, spotScore, writeSpotFlags } from './spot.ts';

const pgn = `[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Qh5 Nc6 *`;

describe('isSpotted', () => {
	it('accepts a flag on the move or on the own move before it', () => {
		expect(isSpotted(7, [7])).toBe(true);
		expect(isSpotted(7, [5])).toBe(true);
		expect(isSpotted(7, [3, 9])).toBe(false);
	});
});

describe('spotScore', () => {
	it('counts spotted turning points and false alarms', () => {
		expect(spotScore([7, 15, 31], [5, 15, 21])).toEqual({ spotted: 2, total: 3, falseAlarms: 1 });
		expect(spotScore([7], [])).toEqual({ spotted: 0, total: 1, falseAlarms: 0 });
	});
});

describe('writeSpotFlags and readSpotFlags', () => {
	it('adds the header after the others and reads it back sorted', () => {
		const written = writeSpotFlags(pgn, [15, 3]);
		expect(written).toContain('[Result "*"]\n[SpotFlags "3 15"]\n\n1. e4');
		expect(readSpotFlags(written)).toEqual([3, 15]);
	});

	it('replaces and removes an existing header', () => {
		const once = writeSpotFlags(pgn, [3]);
		expect(readSpotFlags(writeSpotFlags(once, [5]))).toEqual([5]);
		expect(writeSpotFlags(once, [])).toBe(pgn);
	});

	it('reads nothing without the header', () => {
		expect(readSpotFlags(pgn)).toEqual([]);
	});

	it('survives writing notes', () => {
		const written = writeNotes(writeSpotFlags(pgn, [3]), { 3: emptyNotes() });
		expect(readSpotFlags(written)).toEqual([3]);
		expect(readNotes(written)).toEqual({ 3: emptyNotes() });
	});
});
