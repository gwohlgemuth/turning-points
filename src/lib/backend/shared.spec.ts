import { describe, it, expect } from 'vitest';
import { filesToWrite, formatSync, parseSync } from './shared.ts';

const game = (site: string, notes = '') =>
	`[White "A"]\n[Black "B"]\n[Site "https://lichess.org/${site}"]\n\n1. e4 ${notes}e5 *\n`;

describe('parseSync', () => {
	it('reads a sync file back', () => {
		const data = {
			files: [{ path: 'a.pgn', text: game('a') }],
			review: { k: { learned: true as const } }
		};
		expect(parseSync(formatSync(data))).toEqual(data);
	});

	it('returns null for plain PGN', () => {
		expect(parseSync(game('a'))).toBeNull();
	});
});

describe('filesToWrite', () => {
	it('adds new games and keeps the richer version of the same game', () => {
		const existing = [
			{ path: 'a.pgn', text: game('a') },
			{ path: 'b.pgn', text: game('b', '{ my notes } ') }
		];
		const incoming = [
			{ path: 'x.pgn', text: game('a', '{ notes } ') },
			{ path: 'b.pgn', text: game('b') },
			{ path: 'a.pgn', text: game('c') }
		];
		expect(filesToWrite(existing, incoming)).toEqual([
			{ path: 'a.pgn', text: game('a', '{ notes } ') },
			{ path: 'a (2).pgn', text: game('c') }
		]);
	});
});
