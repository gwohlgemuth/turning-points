import { describe, it, expect } from 'vitest';
import { emptyNotes, writeNotes } from './notes.ts';
import { collectStats, entriesFromPgn } from './stats.ts';

const game = (white: string, date: string) => `[White "${white}"]
[Black "B"]
[Date "${date}"]
[Result "*"]

1. e4 e5 2. Qh5 Nc6 *`;

const older = writeNotes(game('A', '2026.10.01'), {
	3: { ...emptyNotes(), answers: ['Attack', '', ''], candidate: 'Nf3', verdict: 'found' }
});
const newer = writeNotes(game('C', '2026.10.05'), {
	1: { ...emptyNotes(), candidate: 'd4', verdict: 'missed' },
	3: { ...emptyNotes(), answers: ['Only this', '', ''] }
});

describe('entriesFromPgn', () => {
	it('lists each turning point with notes', () => {
		expect(entriesFromPgn('a.pgn', older)).toEqual([
			{
				file: 'a.pgn',
				date: Date.parse('2026-10-01'),
				white: 'A',
				black: 'B',
				ply: 3,
				move: 'Qh5',
				fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
				candidate: 'Nf3',
				verdict: 'found',
				answered: 1
			}
		]);
	});

	it('returns nothing for games without notes or invalid PGN', () => {
		expect(entriesFromPgn('x.pgn', game('A', '2026.10.01'))).toEqual([]);
		expect(entriesFromPgn('x.pgn', 'not a game')).toEqual([]);
	});
});

describe('collectStats', () => {
	it('sorts the newest game first and counts the verdicts', () => {
		const { entries, summary } = collectStats([
			{ path: 'old.pgn', text: older },
			{ path: 'sub/new.pgn', text: newer }
		]);
		expect(entries.map((entry) => [entry.file, entry.ply])).toEqual([
			['sub/new.pgn', 1],
			['sub/new.pgn', 3],
			['old.pgn', 3]
		]);
		expect(summary).toEqual({ games: 2, turningPoints: 3, found: 1, missed: 1, unchecked: 1 });
	});

	it('reads every game of a file with several games', () => {
		const { summary } = collectStats([{ path: 'both.pgn', text: `${older}\n${newer}` }]);
		expect(summary.games).toBe(2);
		expect(summary.turningPoints).toBe(3);
	});
});
