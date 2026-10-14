import { describe, it, expect } from 'vitest';
import { emptyNotes, writeNotes } from './notes.ts';
import { collectStats, entriesFromPgn, savedGames } from './stats.ts';

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
				confidence: '',
				lesson: '',
				answered: 1,
				phase: 'opening',
				time: null,
				tactical: false,
				missedWin: false,
				opening: '',
				spotted: null
			}
		]);
	});

	it('marks a missed win from the stored best line', () => {
		const pgn = writeNotes(game('A', '2026.10.01'), {
			4: { ...emptyNotes(), candidate: 'Nf6', verdict: 'missed', best: 'd6 Qxf7+ Kxf7' }
		});
		expect(entriesFromPgn('a.pgn', pgn)[0]).toMatchObject({ tactical: false, missedWin: true });
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
		expect(summary).toEqual({
			games: 2,
			turningPoints: 3,
			worked: 3,
			found: 1,
			missed: 1,
			unchecked: 1
		});
	});

	it('counts bare turning point markers but not as worked on', () => {
		const marked = writeNotes(game('D', '2026.10.06'), { 1: emptyNotes(), 3: emptyNotes() });
		const { summary } = collectStats([
			{ path: 'old.pgn', text: older },
			{ path: 'marked.pgn', text: marked }
		]);
		expect(summary).toMatchObject({ turningPoints: 3, worked: 1, unchecked: 2 });
	});

	it('reads every game of a file with several games', () => {
		const { summary } = collectStats([{ path: 'both.pgn', text: `${older}\n${newer}` }]);
		expect(summary.games).toBe(2);
		expect(summary.turningPoints).toBe(3);
	});
});

describe('savedGames', () => {
	it('lists every saved game newest first with its progress', () => {
		const plain = game('E', '2026.09.01').replace(
			'[Result',
			'[Site "https://lichess.org/abc"]\n[Result'
		);
		const games = savedGames([
			{ path: 'both.pgn', text: `${older}\n${newer}` },
			{ path: 'plain.pgn', text: plain }
		]);
		expect(
			games.map(({ id, white, url, worked, found, missed }) => [
				id,
				white,
				url,
				worked,
				found,
				missed
			])
		).toEqual([
			['saved:both.pgn:1', 'C', '', 2, 0, 1],
			['saved:both.pgn:0', 'A', '', 1, 1, 0],
			['saved:plain.pgn:0', 'E', 'https://lichess.org/abc', 0, 0, 0]
		]);
	});

	it('keeps the copy with the most progress when a game is saved twice', () => {
		const site = '[Site "https://lichess.org/xyz"]\n';
		const games = savedGames([
			{ path: 'all.pgn', text: site + game('A', '2026.10.01') },
			{ path: 'one.pgn', text: site + older }
		]);
		expect(games.map((saved) => [saved.file, saved.worked])).toEqual([['one.pgn', 1]]);
	});
});
