import { describe, expect, it } from 'vitest';
import { findTurningPoints } from '../analysis.ts';
import { gameKey } from '../games.ts';
import { readNotes } from '../notes.ts';
import { DEMO_GAMES } from './games.ts';
import data from './demo.json';
import { demo, demoKey } from './mode.ts';

describe('demoKey', () => {
	it('keeps the key outside the demo', () => {
		expect(demoKey('turning-points', false)).toBe('turning-points');
	});

	it('separates the demo storage', () => {
		expect(demoKey('turning-points', true)).toBe('turning-points-demo');
	});
});

describe('demo mode', () => {
	it('is off outside the browser build', () => {
		expect(demo).toEqual({ active: false, entering: false });
	});
});

describe('demo data', () => {
	it('has an analysis for every game', () => {
		expect(data.recent.map((entry) => entry.key)).toEqual(
			DEMO_GAMES.map((game) => gameKey(game.pgn))
		);
	});

	it('opens the first game', () => {
		expect(data.current.key).toBe(data.recent[0].key);
	});

	it('keeps the notes on the turning points', () => {
		for (const file of data.files) {
			const entry = data.recent.find((other) => other.pgn === file.text)!;
			const game = DEMO_GAMES.find((other) => gameKey(other.pgn) === entry.key)!;
			const plies = findTurningPoints(
				entry.evals.map((e) => e.winPercent),
				3,
				game.side
			).map((tp) => tp.ply);
			expect(Object.keys(readNotes(file.text)).map(Number)).toEqual(plies);
			for (const ply of Object.keys(game.notes)) expect(plies).toContain(Number(ply));
		}
	});
});
