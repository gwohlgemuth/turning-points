import { describe, it, expect } from 'vitest';
import { emptyNotes, writeNotes } from '../notes.ts';
import { filesToWrite, formatSync, isGameList, parseSync } from './shared.ts';

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

	it('skips files it already has', () => {
		const existing = [{ path: 'a.pgn', text: game('a') }];
		expect(filesToWrite(existing, [{ path: 'b.pgn', text: game('a') }])).toEqual([]);
	});

	it('leaves out game lists', () => {
		const list = { path: 'list.pgn', text: game('a') + '\n' + game('b') };
		expect(filesToWrite([], [list])).toEqual([]);
	});
});

describe('isGameList', () => {
	it('is a file of several games without notes', () => {
		const noted = writeNotes(game('a'), { 1: emptyNotes() });
		expect(isGameList({ path: 'a.pgn', text: game('a') + '\n' + game('b') })).toBe(true);
		expect(isGameList({ path: 'a.pgn', text: game('a') })).toBe(false);
		expect(isGameList({ path: 'a.pgn', text: noted + '\n' + game('b') })).toBe(false);
	});
});
