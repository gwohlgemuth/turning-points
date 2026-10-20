import { describe, it, expect } from 'vitest';
import { emptyNotes, writeNotes } from './notes.ts';
import type { GameSummary } from './games.ts';
import { collectStats, entriesFromPgn, nextGame, savedGames, type SavedGame } from './stats.ts';

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
				cause: '',
				lesson: '',
				answered: 1,
				phase: 'opening',
				time: null,
				timeRatio: null,
				tactical: false,
				missedWin: false,
				opening: '',
				book: 4,
				speed: null,
				spotted: null
			}
		]);
	});

	it('compares the time spent on a turning point with the usual time per move', () => {
		const sans = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6'.split(' ');
		const white = [298, 296, 294, 292, 290, 270, 260];
		const clock = (seconds: number) =>
			`{ [%clk 0:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}] }`;
		const moves = sans
			.map((san, i) => {
				const number = i % 2 ? '' : `${i / 2 + 1}. `;
				const remaining = i % 2 ? 299 - (i - 1) / 2 : white[i / 2];
				return `${number}${san} ${clock(remaining)}`;
			})
			.join(' ');
		const pgn = writeNotes(`[TimeControl "300+0"]\n[Result "*"]\n\n${moves} *`, {
			13: { ...emptyNotes(), candidate: 'h3' }
		});
		expect(entriesFromPgn('a.pgn', pgn)[0].timeRatio).toBeCloseTo(10 / 15);
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

	it('counts the turning points still open and the side they were marked for', () => {
		const games = savedGames([{ path: 'both.pgn', text: `${older}\n${newer}` }]);
		expect(games.map(({ white, open, side }) => [white, open, side])).toEqual([
			['C', 1, 'w'],
			['A', 0, 'w']
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

describe('nextGame', () => {
	const online = (id: string, white: string, black: string, date: number) =>
		({ id, url: `https://lichess.org/${id}`, white, black, date }) as GameSummary;
	const saved = (id: string, open: number, date: number, url = '') =>
		({ id, url, white: 'x', black: 'y', date, open, worked: 1, side: 'b' }) as SavedGame;

	it('takes the newest game with work left, from either list', () => {
		const next = nextGame(
			[online('a', 'me', 'x', 1), online('b', 'y', 'z', 9)],
			[saved('s', 2, 5), saved('t', 0, 8)],
			'me',
			new Set(),
			0
		);
		expect([next?.game.id, next?.side]).toEqual(['s', 'b']);
	});

	it('prefers the saved copy of an online game and skips finished or visited games', () => {
		const url = 'https://lichess.org/a';
		const games = [online('a', 'me', 'x', 3), online('c', 'x', 'me', 2)];
		expect(nextGame(games, [saved('s', 1, 3, url)], 'me', new Set(), 0)?.game.id).toBe('s');
		expect(nextGame(games, [saved('s', 0, 3, url)], 'me', new Set(), 0)?.game.id).toBe('c');
		expect(nextGame(games, [], 'me', new Set([url, 'https://lichess.org/c']), 0)).toBeNull();
	});

	it('counts saved games without any turning points marked as not analyzed yet', () => {
		const unmarked = { ...saved('s', 0, 3, 'https://lichess.org/a'), worked: 0 };
		expect(nextGame([online('a', 'me', 'x', 3)], [unmarked], 'me', new Set(), 0)?.game.id).toBe(
			's'
		);
	});

	it("falls back to other players' games when none are the user's", () => {
		expect(nextGame([online('b', 'y', 'z', 1)], [], 'me', new Set(), 0)?.side).toBe('w');
	});

	it('goes to the next older game with work left, and from the oldest back to the newest', () => {
		const games = [4, 3, 2, 1].map((date) => online(`g${date}`, 'me', 'x', date));
		expect(nextGame(games, [], 'me', new Set(['https://lichess.org/g3']), 3)?.game.id).toBe('g2');
		expect(nextGame(games, [], 'me', new Set(), 1)?.game.id).toBe('g4');
	});
});
