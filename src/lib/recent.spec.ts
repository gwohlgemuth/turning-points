import { describe, it, expect } from 'vitest';
import { findAnalysis, remember, updatePgn, type RecentEntry } from './recent.ts';

const entry = (key: string, depth = 16): RecentEntry => ({
	key,
	pgn: `pgn-${key}`,
	depth,
	startFen: '',
	moves: [],
	headers: {},
	evals: [],
	analyzedAt: 0
});

describe('remember', () => {
	it('puts the newest game first and keeps one entry per game', () => {
		const list = remember(remember(remember([], entry('a')), entry('b')), entry('a', 20));
		expect(list.map((e) => [e.key, e.depth])).toEqual([
			['a', 20],
			['b', 16]
		]);
	});

	it('keeps at most the given number of games', () => {
		let list: RecentEntry[] = [];
		for (const key of ['a', 'b', 'c']) list = remember(list, entry(key), 2);
		expect(list.map((e) => e.key)).toEqual(['c', 'b']);
	});
});

describe('findAnalysis and updatePgn', () => {
	it('finds a game only at the same depth', () => {
		const list = [entry('a', 16)];
		expect(findAnalysis(list, 'a', 16)).toBe(list[0]);
		expect(findAnalysis(list, 'a', 18)).toBeNull();
		expect(findAnalysis(list, null, 16)).toBeNull();
	});

	it('replaces the stored PGN of a game', () => {
		const list = updatePgn([entry('a'), entry('b')], 'b', 'notes');
		expect(list.map((e) => e.pgn)).toEqual(['pgn-a', 'notes']);
	});
});
