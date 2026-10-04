import { describe, it, expect } from 'vitest';
import { playerSide, type GameSummary } from './games.ts';

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
