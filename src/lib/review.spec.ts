import { describe, it, expect } from 'vitest';
import { addDays, cardKey, nextState, parseReviewState, reviewDeck } from './review.ts';
import type { StatsEntry } from './stats.ts';

const entry = (ply: number, verdict: StatsEntry['verdict'], fen = `fen-${ply}`): StatsEntry => ({
	file: 'a.pgn',
	date: 0,
	white: 'A',
	black: 'B',
	ply,
	move: 'e4',
	fen,
	candidate: 'd4',
	verdict,
	answered: 0
});

describe('nextState', () => {
	it('moves a found card up the boxes until it is learned', () => {
		const today = '2026-10-08';
		let state = nextState(undefined, true, today);
		expect(state).toEqual({ box: 1, due: '2026-10-09' });
		const dues = [];
		for (let i = 0; i < 4; i++) {
			state = nextState(state, true, today);
			dues.push('due' in state ? state.due : null);
		}
		expect(dues).toEqual(['2026-10-11', '2026-10-15', '2026-10-22', '2026-11-07']);
		expect(nextState(state, true, today)).toEqual({ learned: true });
	});

	it('sends a missed card back to the first box', () => {
		expect(nextState({ box: 4, due: '2026-10-08' }, false, '2026-10-08')).toEqual({
			box: 0,
			due: '2026-10-09'
		});
	});
});

describe('reviewDeck', () => {
	it('deals only missed turning points that are due', () => {
		const entries = [
			entry(1, 'missed'),
			entry(2, 'found'),
			entry(3, 'missed'),
			entry(4, 'missed'),
			entry(5, 'missed'),
			entry(7, 'missed', 'fen-1')
		];
		const state = {
			[cardKey('fen-3', 'e4')]: { box: 1, due: '2026-10-09' },
			[cardKey('fen-4', 'e4')]: { learned: true as const },
			[cardKey('fen-5', 'e4')]: { box: 2, due: '2026-10-01' }
		};
		const deck = reviewDeck(entries, state, '2026-10-08');
		expect(deck.due.map((card) => [card.ply, card.side])).toEqual([
			[1, 'w'],
			[5, 'w']
		]);
		expect(deck.upcoming).toBe(1);
		expect(deck.learned).toBe(1);
	});
});

describe('helpers', () => {
	it('adds days across months', () => {
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
	});

	it('ignores a malformed state file', () => {
		expect(parseReviewState('nope')).toEqual({});
		expect(parseReviewState('[]')).toEqual({});
	});
});
