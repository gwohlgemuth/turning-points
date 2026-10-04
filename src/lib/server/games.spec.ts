import { describe, it, expect } from 'vitest';
import { fromChessCom, fromLichess } from './games.ts';

const pgn = '[White "A"]\n[Black "B"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1';

describe('fromLichess', () => {
	it('converts a game including anonymous and computer players', () => {
		const game = fromLichess({
			id: 'abc123',
			createdAt: 1700000000000,
			speed: 'blitz',
			players: { white: { user: { name: 'Alice' }, rating: 1800 }, black: { aiLevel: 5 } },
			pgn
		});
		expect(game).toMatchObject({
			url: 'https://lichess.org/abc123',
			white: 'Alice',
			black: 'Stockfish level 5',
			whiteRating: 1800,
			blackRating: null,
			result: '0-1',
			timeClass: 'blitz'
		});
	});
});

describe('fromChessCom', () => {
	it('converts a game and the end time to milliseconds', () => {
		const game = fromChessCom({
			uuid: 'u-1',
			url: 'https://www.chess.com/game/live/1',
			pgn,
			end_time: 1700000000,
			time_class: 'rapid',
			rules: 'chess',
			white: { username: 'Alice', rating: 1500 },
			black: { username: 'Bob', rating: 1550 }
		});
		expect(game).toMatchObject({
			id: 'u-1',
			white: 'Alice',
			black: 'Bob',
			result: '0-1',
			date: 1700000000000,
			timeClass: 'rapid'
		});
	});
});
