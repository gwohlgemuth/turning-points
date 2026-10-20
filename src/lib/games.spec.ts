import { describe, it, expect } from 'vitest';
import {
	candidateNames,
	filterGames,
	gameKey,
	gameOutcome,
	gamesToPgn,
	mergeAdjacentComments,
	parseRating,
	pgnFilename,
	sameGame,
	playerSide,
	playersByCount,
	splitPgn,
	summaryFromPgn,
	formatWhen,
	hasNoTurningPoints,
	markNoTurningPoints,
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

describe('parseRating', () => {
	it('reads numeric ratings and ignores unknown ones', () => {
		expect(parseRating('1604')).toBe(1604);
		expect(parseRating('?')).toBeNull();
		expect(parseRating(undefined)).toBeNull();
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

describe('markNoTurningPoints', () => {
	const pgn = '[White "A"]\n[Result "*"]\n\n1. e4 *';

	it('marks a game without turning points and removes the mark again', () => {
		const marked = markNoTurningPoints(pgn, true);
		expect(marked).toContain('[Result "*"]\n[TurningPoints "0"]\n\n1. e4');
		expect(hasNoTurningPoints(marked)).toBe(true);
		expect(markNoTurningPoints(marked, false)).toBe(pgn);
		expect(hasNoTurningPoints(pgn)).toBe(false);
	});
});

describe('formatWhen', () => {
	it('shows the time only when the game has one', () => {
		expect(formatWhen(Date.parse('2026-10-11T14:05:30Z'))).toMatch(/\d{1,2}[:.]\d{2}/);
		expect(formatWhen(Date.parse('2026-10-11'))).not.toMatch(/\d{1,2}:\d{2}/);
		expect(formatWhen(0)).toBe('');
	});
});

describe('summaryFromPgn', () => {
	it('adds the UTC time of day when the game has one', () => {
		const pgn = '[UTCDate "2026.10.11"]\n[UTCTime "14:05:30"]\n\n1. e4 *';
		expect(summaryFromPgn(pgn, 0).date).toBe(Date.parse('2026-10-11T14:05:30Z'));
		expect(summaryFromPgn('[Date "2026.10.11"]\n[UTCTime "14:05:30"]\n\n1. e4 *', 0).date).toBe(
			Date.parse('2026-10-11')
		);
	});

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

describe('sameGame', () => {
	it('compares game URLs when both games have one', () => {
		const a = '[Site "https://lichess.org/abc"]\n\n1. e4 e5 *';
		expect(sameGame(a, '[Site "https://lichess.org/abc"]\n\n1. e4 { note } e5 *')).toBe(true);
		expect(sameGame(a, '[Site "https://lichess.org/xyz"]\n\n1. e4 e5 *')).toBe(false);
		expect(
			sameGame(
				'[Site "Chess.com"]\n[Link "https://www.chess.com/game/live/1"]\n\n1. e4 *',
				'[Site "Chess.com"]\n[Link "https://www.chess.com/game/live/2"]\n\n1. e4 *'
			)
		).toBe(false);
	});

	it('falls back to players and moves without game URLs', () => {
		const a = '[White "A"]\n[Black "B"]\n\n1. e4 e5 *';
		expect(sameGame(a, '[White "A"]\n[Black "B"]\n\n1. e4 { Turning point. } e5 *')).toBe(true);
		expect(sameGame(a, '[White "A"]\n[Black "B"]\n\n1. d4 d5 *')).toBe(false);
		expect(sameGame(a, '[White "A"]\n[Black "C"]\n\n1. e4 e5 *')).toBe(false);
		expect(sameGame('not a game', 'not a game')).toBe(false);
	});

	it('never matches a file with several games', () => {
		const a = '[White "A"]\n[Black "B"]\n\n1. e4 e5 *';
		expect(sameGame(`${a}\n\n${a}`, a)).toBe(false);
	});
});

describe('gameOutcome and filterGames', () => {
	const make = (white: string, black: string, result: string, date: string) =>
		summaryFromPgn(
			`[White "${white}"]\n[Black "${black}"]\n[Result "${result}"]\n[UTCDate "${date}"]\n\n1. e4 *`,
			0
		);
	const games = [
		make('me', 'Alice', '1-0', '2026.10.01'),
		make('Bob', 'me', '1-0', '2026.10.02'),
		make('me', 'Carol', '1/2-1/2', '2026.10.03')
	];

	it('tells the outcome from a perspective', () => {
		expect(games.map((game) => gameOutcome(game, 'ME'))).toEqual(['win', 'loss', 'draw']);
		expect(gameOutcome(games[0], 'nobody')).toBeNull();
	});

	it('filters by words and outcome', () => {
		expect(filterGames(games, 'ali', '', 'me').map((game) => game.black)).toEqual(['Alice']);
		expect(filterGames(games, ' me  bob ', '', 'me').map((game) => game.white)).toEqual(['Bob']);
		expect(filterGames(games, '', 'loss', 'me').map((game) => game.white)).toEqual(['Bob']);
		expect(filterGames(games, '', '', 'me')).toHaveLength(3);
	});
});

describe('gameKey', () => {
	it('prefers the game URL and falls back to players and moves', () => {
		expect(gameKey('[Site "https://lichess.org/abc"]\n\n1. e4 *')).toBe('https://lichess.org/abc');
		expect(gameKey('[White "A"]\n[Black "B"]\n\n1. e4 e5 *')).toBe('A B e4 e5');
		expect(gameKey('not a game 1. Kx9')).toBeNull();
	});
});

describe('candidateNames', () => {
	it('numbers the file name after the first candidate', () => {
		const names = candidateNames('A-vs-B.PGN');
		expect(names.slice(0, 3)).toEqual(['A-vs-B.PGN', 'A-vs-B (2).pgn', 'A-vs-B (3).pgn']);
		expect(names).toHaveLength(999);
	});
});
