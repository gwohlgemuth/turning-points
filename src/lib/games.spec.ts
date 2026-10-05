import { describe, it, expect } from 'vitest';
import {
	gamesToPgn,
	mergeAdjacentComments,
	pgnFilename,
	playerSide,
	playersByCount,
	splitPgn,
	summaryFromPgn,
	winner,
	type GameSummary
} from './games.ts';

const game = { white: 'MagnusFan', black: 'hikaru' } as GameSummary;

describe('playerSide', () => {
	it('finds the color of the user, ignoring case', () => {
		expect(playerSide(game, 'magnusfan')).toBe('w');
		expect(playerSide(game, ' Hikaru ')).toBe('b');
	});

	it('returns null when the user did not play the game', () => {
		expect(playerSide(game, 'someone')).toBeNull();
	});
});

describe('mergeAdjacentComments', () => {
	it('joins comments that follow each other into one', () => {
		expect(mergeAdjacentComments('1. d4 { [%eval 0.15] } { A45 } 1... Nf6 { x } 1-0')).toBe(
			'1. d4 { [%eval 0.15]   A45 } 1... Nf6 { x } 1-0'
		);
	});
});

describe('winner', () => {
	it('maps the PGN result to the winning side', () => {
		expect(winner('1-0')).toBe('w');
		expect(winner('0-1')).toBe('b');
		expect(winner('1/2-1/2')).toBe('draw');
		expect(winner('*')).toBeNull();
	});
});

const first =
	'[White "A"]\n[Black "B"]\n[Result "1-0"]\n[WhiteElo "1500"]\n[Date "2026.10.03"]\n\n1. e4 e5 1-0';
const second = '[White "C"]\n[Black "D"]\n[Result "0-1"]\n[BlackElo "?"]\n\n1. d4 d5 0-1';

describe('gamesToPgn and splitPgn', () => {
	it('round-trips several games through one PGN file', () => {
		const text = gamesToPgn([{ pgn: first }, { pgn: second }] as GameSummary[]);
		expect(splitPgn(text)).toEqual([first, second]);
	});

	it('keeps a single game with Windows line endings in one piece', () => {
		expect(splitPgn(first.replaceAll('\n', '\r\n'))).toEqual([first]);
	});
});

describe('summaryFromPgn', () => {
	it('reads players, ratings, result and date from the headers', () => {
		expect(summaryFromPgn(first, 0)).toMatchObject({
			id: 'file-0',
			white: 'A',
			black: 'B',
			whiteRating: 1500,
			blackRating: null,
			result: '1-0',
			date: Date.parse('2026-10-03')
		});
	});

	it('handles missing or unknown values', () => {
		expect(summaryFromPgn(second, 1)).toMatchObject({ blackRating: null, date: 0 });
	});
});

describe('playersByCount', () => {
	it('lists the players by number of games, then by name', () => {
		const games = [
			{ white: 'me', black: 'Bob' },
			{ white: 'Carl', black: 'me' },
			{ white: 'Bob', black: 'Anna' },
			{ white: 'me', black: 'Dora' }
		] as GameSummary[];
		expect(playersByCount(games)).toEqual(['me', 'Bob', 'Anna', 'Carl', 'Dora']);
	});
});

describe('pgnFilename', () => {
	it('names the file after the players and the date', () => {
		expect(pgnFilename(first)).toBe('A-vs-B-2026-10-03.pgn');
	});

	it('replaces unsafe characters but keeps letters like umlauts', () => {
		const pgn = '[White "Müller, Hans"]\n[Black "O\'Neil/Jr"]\n[Date "????.??.??"]\n\n1. e4 *';
		expect(pgnFilename(pgn)).toBe('Müller_Hans-vs-O_Neil_Jr.pgn');
	});

	it('falls back to a dated name without player headers', () => {
		expect(pgnFilename('1. e4 e5 *')).toMatch(/^game-\d{4}-\d{2}-\d{2}\.pgn$/);
		expect(pgnFilename('[White "?"]\n[Black "B"]\n\n1. e4 *')).toMatch(/^game-/);
	});
});
