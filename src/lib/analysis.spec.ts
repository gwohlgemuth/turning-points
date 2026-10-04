import { describe, it, expect } from 'vitest';
import {
	cpToWinPercent,
	findTurningPoints,
	formatScore,
	moveLabel,
	toWhitePerspective,
	winPercent
} from './analysis.ts';

describe('cpToWinPercent', () => {
	it('is 50 for an equal position', () => {
		expect(cpToWinPercent(0)).toBe(50);
	});

	it('is symmetric', () => {
		expect(cpToWinPercent(300) + cpToWinPercent(-300)).toBeCloseTo(100);
	});

	it('flattens out in clearly decided positions', () => {
		const smallSwing = cpToWinPercent(100) - cpToWinPercent(0);
		const largeSwing = cpToWinPercent(900) - cpToWinPercent(800);
		expect(smallSwing).toBeGreaterThan(largeSwing * 5);
	});
});

describe('winPercent', () => {
	it('treats mate scores as decided', () => {
		expect(winPercent({ type: 'mate', value: 3 }, true)).toBe(100);
		expect(winPercent({ type: 'mate', value: -2 }, true)).toBe(0);
	});

	it('handles a checkmated side to move', () => {
		expect(winPercent({ type: 'mate', value: 0 }, true)).toBe(0);
		expect(winPercent({ type: 'mate', value: 0 }, false)).toBe(100);
	});
});

describe('toWhitePerspective', () => {
	it('flips the score when black is to move', () => {
		expect(toWhitePerspective({ type: 'cp', value: 40 }, false)).toEqual({
			type: 'cp',
			value: -40
		});
		expect(toWhitePerspective({ type: 'cp', value: 40 }, true)).toEqual({ type: 'cp', value: 40 });
	});
});

describe('formatScore', () => {
	it('formats centipawns and mates', () => {
		expect(formatScore({ type: 'cp', value: 123 })).toBe('+1.23');
		expect(formatScore({ type: 'cp', value: -50 })).toBe('-0.50');
		expect(formatScore({ type: 'mate', value: 4 })).toBe('M4');
		expect(formatScore({ type: 'mate', value: -1 })).toBe('-M1');
		expect(formatScore({ type: 'mate', value: 0 })).toBe('#');
	});
});

describe('findTurningPoints', () => {
	const series = [50, 52, 30, 31, 80, 79, 78, 20];

	it('returns the n largest swings in chronological order', () => {
		const points = findTurningPoints(series, 3);
		expect(points.map((p) => p.ply)).toEqual([2, 4, 7]);
		expect(points[2].delta).toBe(-58);
	});

	it('returns all swings when n exceeds the number of moves', () => {
		expect(findTurningPoints(series, 100)).toHaveLength(7);
	});

	it('returns nothing for n = 0 or an empty game', () => {
		expect(findTurningPoints(series, 0)).toEqual([]);
		expect(findTurningPoints([50], 3)).toEqual([]);
	});
});

describe('moveLabel', () => {
	it('numbers white and black moves', () => {
		expect(moveLabel(1, 'e4')).toBe('1. e4');
		expect(moveLabel(4, 'Nf6')).toBe('2… Nf6');
	});
});
