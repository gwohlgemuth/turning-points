import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
	gamePhase,
	lostMaterial,
	openingLeaks,
	profile,
	progress,
	repeatedPositions,
	rulebook,
	timeAtTurningPoints,
	timeTag,
	winsMaterial
} from './profile.ts';
import type { StatsEntry } from './stats.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const entry = (patch: Partial<StatsEntry>): StatsEntry => ({
	file: 'a.pgn',
	date: 0,
	white: 'A',
	black: 'B',
	ply: 10,
	move: 'e4',
	fen: START,
	candidate: '',
	verdict: '',
	confidence: '',
	cause: '',
	lesson: '',
	answered: 0,
	phase: 'middlegame',
	time: null,
	timeRatio: null,
	tactical: false,
	missedWin: false,
	opening: '',
	book: null,
	speed: null,
	spotted: null,
	lastMove: null,
	...patch
});

describe('gamePhase', () => {
	it('tells opening, middlegame and endgame apart', () => {
		expect(gamePhase(START)).toBe('opening');
		expect(gamePhase(START.replace(' 0 1', ' 0 20'))).toBe('middlegame');
		expect(gamePhase('4k3/pp3ppp/2r5/8/8/2B5/PP3PPP/2R3K1 w - - 0 30')).toBe('endgame');
		expect(gamePhase('3qk3/pp3ppp/2r5/8/8/2B5/PP3PPP/2R3K1 w - - 0 30')).toBe('middlegame');
	});
});

describe('timeTag', () => {
	const control = { base: 180, increment: 0 };

	it('marks time trouble before quick moves', () => {
		expect(timeTag({ spent: 1, remaining: 10 }, control)).toBe('trouble');
		expect(timeTag({ spent: 2, remaining: 120 }, control)).toBe('quick');
		expect(timeTag({ spent: 20, remaining: 120 }, control)).toBe('normal');
	});

	it('returns null without clock data', () => {
		expect(timeTag(null, control)).toBeNull();
		expect(timeTag({ spent: 2, remaining: 120 }, null)).toBeNull();
	});
});

describe('lostMaterial', () => {
	const history = (pgn: string) => {
		const chess = new Chess();
		chess.loadPgn(pgn);
		return chess.history({ verbose: true });
	};

	it('sees material lost within the next moves', () => {
		const moves = history('1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5');
		expect(lostMaterial(moves, 5)).toBe(true);
		expect(lostMaterial(moves, 1)).toBe(false);
	});

	it('ignores an exchange', () => {
		const moves = history('1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5');
		expect(lostMaterial(moves, 3)).toBe(false);
	});
});

describe('profile', () => {
	it('groups by confidence and leaves out turning points without one', () => {
		const result = profile([
			entry({ confidence: 'sure', verdict: 'missed' }),
			entry({ confidence: 'sure', verdict: 'found' }),
			entry({ confidence: 'guess', verdict: 'found' }),
			entry({ verdict: 'missed' })
		]);
		expect(result.confidence.map(({ label, total, missed }) => [label, total, missed])).toEqual([
			['Sure', 2, 1],
			['Guess', 1, 0]
		]);
	});

	it('groups by cause in the order of the causes', () => {
		const result = profile([
			entry({ cause: 'plan', verdict: 'missed' }),
			entry({ cause: 'threat', verdict: 'found' }),
			entry({ cause: 'plan' }),
			entry({})
		]);
		expect(result.cause.map(({ label, total, missed }) => [label, total, missed])).toEqual([
			['Missed a threat', 1, 0],
			['Wrong plan', 2, 1]
		]);
	});

	it('counts each group and leaves out empty ones', () => {
		const result = profile([
			entry({ phase: 'endgame', verdict: 'missed', tactical: true, time: 'trouble' }),
			entry({ phase: 'endgame', verdict: 'found' }),
			entry({ phase: 'opening' })
		]);
		expect(
			result.phase.map(({ label, total, found, missed }) => [label, total, found, missed])
		).toEqual([
			['Opening', 1, 0, 0],
			['Endgame', 2, 1, 1]
		]);
		expect(result.time).toEqual([
			{
				label: 'Time trouble',
				hint: 'Less than 10% of the base time left',
				total: 1,
				found: 0,
				missed: 1
			}
		]);
		expect(result.kind.map((row) => [row.label, row.total])).toEqual([
			['Material lost', 1],
			['Positional', 2]
		]);
	});
});

describe('rulebook', () => {
	it('groups the rules by cause, most common first, and puts rules without a cause last', () => {
		const result = rulebook([
			entry({ lesson: 'No cause', ply: 1 }),
			entry({ lesson: 'Plan A', cause: 'plan', ply: 2 }),
			entry({ lesson: 'Threat', cause: 'threat', ply: 3 }),
			entry({ lesson: 'Plan B', cause: 'plan', ply: 4 }),
			entry({ lesson: ' ', cause: 'rushed', ply: 5 })
		]);
		expect(result.map(({ label, rules }) => [label, rules.map((rule) => rule.lesson)])).toEqual([
			['Wrong plan', ['Plan A', 'Plan B']],
			['Missed a threat', ['Threat']],
			['No cause given', ['No cause']]
		]);
	});
});

describe('timeAtTurningPoints', () => {
	it('takes the median of the time ratios and skips games without clocks', () => {
		expect(
			timeAtTurningPoints([
				entry({ timeRatio: 0.5 }),
				entry({ timeRatio: 3 }),
				entry({ timeRatio: 1 }),
				entry({})
			])
		).toEqual({ ratio: 1, count: 3 });
		expect(timeAtTurningPoints([entry({})])).toBeNull();
	});
});

describe('winsMaterial', () => {
	it('sees a line that wins material', () => {
		const fork = 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
		expect(winsMaterial(fork, ['Nc7+', 'Kd7', 'Nxa8'])).toBe(true);
		expect(winsMaterial(fork, ['Kd2', 'Qa2+'])).toBe(false);
	});

	it('ignores an exchange and an illegal line', () => {
		const exchange = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
		expect(winsMaterial(exchange, ['exd5', 'Qxd5'])).toBe(false);
		expect(winsMaterial(START, ['Ke2', 'e5'])).toBe(false);
		expect(winsMaterial(START, [])).toBe(false);
	});
});

describe('openingLeaks', () => {
	it('groups early turning points by opening', () => {
		const leaks = openingLeaks([
			entry({ opening: 'Sicilian Defense', ply: 8, book: 6, verdict: 'missed' }),
			entry({ opening: 'Sicilian Defense', ply: 12, book: 4, date: 1 }),
			entry({ opening: 'Sicilian Defense', ply: 40 }),
			entry({ ply: 5 })
		]);
		expect(leaks).toEqual([
			{
				opening: 'Sicilian Defense',
				games: 2,
				turningPoints: 2,
				leavingBook: 1,
				soonAfterBook: 1,
				missed: 1
			},
			{
				opening: 'Unknown',
				games: 1,
				turningPoints: 1,
				leavingBook: 0,
				soonAfterBook: 0,
				missed: 0
			}
		]);
	});
});

describe('repeatedPositions', () => {
	it('lists positions that turned in more than one game', () => {
		const later = START.replace(' 0 1', ' 4 9');
		const rows = repeatedPositions([
			entry({ move: 'e4', verdict: 'missed' }),
			entry({ fen: later, move: 'd4', date: 1 }),
			entry({ fen: '8/8/8/8/8/8/8/K6k w - - 0 1' })
		]);
		expect(rows).toEqual([{ fen: START, ply: 10, moves: ['e4', 'd4'], games: 2, missed: 1 }]);
	});

	it('does not count the same game twice', () => {
		expect(repeatedPositions([entry({}), entry({ ply: 12 })])).toEqual([]);
	});
});

describe('progress', () => {
	const day = (date: string) => Date.parse(date);

	it('groups by week when the games span up to twelve weeks', () => {
		const points = progress([
			entry({ date: day('2026-10-06'), verdict: 'missed', spotted: true }),
			entry({ date: day('2026-10-11'), verdict: 'found', spotted: false, white: 'C' }),
			entry({ date: day('2026-10-13') }),
			entry({ date: 0 })
		]);
		expect(points).toEqual([
			{ label: '2026-10-05', games: 2, checked: 2, missed: 1, spotChecked: 2, spotted: 1 },
			{ label: '2026-10-12', games: 1, checked: 0, missed: 0, spotChecked: 0, spotted: 0 }
		]);
	});

	it('groups by month over a longer span', () => {
		const points = progress([
			entry({ date: day('2026-01-10') }),
			entry({ date: day('2026-06-02') })
		]);
		expect(points.map((point) => point.label)).toEqual(['2026-01', '2026-06']);
	});

	it('returns nothing without dated games', () => {
		expect(progress([entry({ date: 0 })])).toEqual([]);
	});
});
