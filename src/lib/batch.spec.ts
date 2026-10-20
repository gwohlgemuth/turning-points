import { describe, it, expect } from 'vitest';
import type { PositionEval } from './analysis.ts';
import { markTurningPoints } from './batch.ts';
import { emptyNotes, readNotes } from './notes.ts';

const pgn = `[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Qh5 Nc6 3. Qxe5+ *`;

const evals = (percents: number[]): PositionEval[] =>
	percents.map((winPercent, index) => ({ index, winPercent, score: { type: 'cp', value: 0 } }));

describe('markTurningPoints', () => {
	it('marks the biggest swings of the chosen side', () => {
		const marked = markTurningPoints(pgn, evals([50, 52, 62, 45, 60, 20]), 2, 'w');
		expect(readNotes(marked)).toEqual({ 3: emptyNotes(), 5: emptyNotes() });
	});

	it('marks a game whose side has no turning points', () => {
		const marked = markTurningPoints(pgn, evals([50, 52, 50, 51, 50, 52]), 3, 'w');
		expect(marked).toContain('[TurningPoints "0"]');
		expect(markTurningPoints(pgn, evals([50, 52, 62, 45, 60, 20]), 3, 'w')).not.toContain(
			'TurningPoints'
		);
	});

	it('only looks at the moves of the given side', () => {
		const marked = markTurningPoints(pgn, evals([50, 52, 62, 45, 60, 20]), 1, 'b');
		expect(Object.keys(readNotes(marked))).toEqual(['4']);
	});
});
