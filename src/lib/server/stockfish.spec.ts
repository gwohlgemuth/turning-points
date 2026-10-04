import { describe, it, expect } from 'vitest';
import { parseInfo } from './stockfish.ts';

describe('parseInfo', () => {
	it('parses centipawn scores and the principal variation', () => {
		const line =
			'info depth 12 seldepth 16 multipv 1 score cp 34 nodes 12345 nps 1000 time 12 pv e2e4 e7e5 g1f3';
		expect(parseInfo(line)).toEqual({
			score: { type: 'cp', value: 34 },
			pv: ['e2e4', 'e7e5', 'g1f3']
		});
	});

	it('parses mate scores', () => {
		expect(parseInfo('info depth 5 score mate -2 pv h2h3')?.score).toEqual({
			type: 'mate',
			value: -2
		});
	});

	it('ignores bound scores and lines without a score', () => {
		expect(parseInfo('info depth 10 score cp 20 lowerbound pv e2e4')).toBeNull();
		expect(parseInfo('info string NNUE enabled')).toBeNull();
		expect(parseInfo('bestmove e2e4')).toBeNull();
	});
});
