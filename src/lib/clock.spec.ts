import { describe, it, expect } from 'vitest';
import {
	describeTime,
	extractClocks,
	formatClock,
	formatDuration,
	formatTimeControl,
	moveTimes,
	parseClock,
	parseTimeControl,
	speedOf
} from './clock.ts';

describe('parseClock', () => {
	it('parses clock values with and without tenths', () => {
		expect(parseClock('0:03:00')).toBe(180);
		expect(parseClock('0:02:59.6')).toBeCloseTo(179.6);
		expect(parseClock('1:00:05')).toBe(3605);
		expect(parseClock('nonsense')).toBeNull();
	});
});

describe('extractClocks', () => {
	it('reads Lichess and Chess.com clock comments in order', () => {
		const lichess = '1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:02:58] } *';
		const chessCom = '1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:02:59.6]} *';
		expect(extractClocks(lichess)).toEqual([180, 178]);
		expect(extractClocks(chessCom)).toEqual([180, 179.6]);
		expect(extractClocks('1. e4 e5 *')).toEqual([]);
	});
});

describe('parseTimeControl', () => {
	it('reads base time and increment', () => {
		expect(parseTimeControl('180+2')).toEqual({ base: 180, increment: 2 });
		expect(parseTimeControl('600')).toEqual({ base: 600, increment: 0 });
	});

	it('ignores correspondence and unknown time controls', () => {
		expect(parseTimeControl('1/259200')).toBeNull();
		expect(parseTimeControl('-')).toBeNull();
		expect(parseTimeControl(undefined)).toBeNull();
	});
});

describe('moveTimes', () => {
	it('computes time spent per move including the increment', () => {
		// 3+2: White 180 → 175 → 170, Black 178 → 160
		const times = moveTimes([180, 178, 175, 160, 170], { base: 180, increment: 2 });
		expect(times.map((t) => t.spent)).toEqual([0, 2, 7, 20, 7]);
		expect(times[3].remaining).toBe(160);
	});
});

describe('formatting', () => {
	it('formats durations and clocks', () => {
		expect(formatDuration(4.25)).toBe('4.3 s');
		expect(formatDuration(42)).toBe('42 s');
		expect(formatDuration(185)).toBe('3:05');
		expect(formatClock(151)).toBe('2:31');
		expect(formatClock(3725)).toBe('1:02:05');
		expect(formatDuration(4)).toBe('4 s');
		expect(describeTime({ spent: 4, remaining: 151 })).toBe('4 s (2:31 left)');
	});
});

describe('formatTimeControl', () => {
	it('shows the base time in minutes and the increment in seconds', () => {
		expect(formatTimeControl({ base: 300, increment: 3 })).toBe('5+3');
		expect(formatTimeControl({ base: 30, increment: 0 })).toBe('0.5+0');
		expect(formatTimeControl({ base: 900, increment: 10 })).toBe('15+10');
	});
});

describe('speedOf', () => {
	it('uses the Lichess estimate of base time plus 40 increments', () => {
		expect(speedOf({ base: 60, increment: 0 })).toBe('bullet');
		expect(speedOf({ base: 180, increment: 2 })).toBe('blitz');
		expect(speedOf({ base: 600, increment: 0 })).toBe('rapid');
		expect(speedOf({ base: 1800, increment: 20 })).toBe('classical');
		expect(speedOf(null)).toBeNull();
	});
});
