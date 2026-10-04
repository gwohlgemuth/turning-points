import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseInfo, Stockfish } from './stockfish.ts';

describe('parseInfo', () => {
	it('parses centipawn scores and the principal variation', () => {
		const line =
			'info depth 12 seldepth 16 multipv 1 score cp 34 nodes 12345 nps 1000 time 12 pv e2e4 e7e5 g1f3';
		expect(parseInfo(line)).toEqual({
			multipv: 1,
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

	it('reads the multipv index', () => {
		expect(parseInfo('info depth 8 multipv 3 score cp -12 pv d2d4')?.multipv).toBe(3);
	});

	it('ignores bound scores and lines without a score', () => {
		expect(parseInfo('info depth 10 score cp 20 lowerbound pv e2e4')).toBeNull();
		expect(parseInfo('info string NNUE enabled')).toBeNull();
		expect(parseInfo('bestmove e2e4')).toBeNull();
	});
});

describe('Stockfish.quit', () => {
	it('does not crash when the engine has already closed its input', async () => {
		const script = join(mkdtempSync(join(tmpdir(), 'engine-')), 'engine.sh');
		writeFileSync(script, '#!/bin/sh\nexec 0<&-\nsleep 1\n');
		chmodSync(script, 0o755);
		const engine = new Stockfish(script);
		await new Promise((resolve) => setTimeout(resolve, 200));
		engine.quit();
		engine.quit();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(true).toBe(true);
	});

	it('does not crash when the engine binary is missing', async () => {
		const engine = new Stockfish('/nonexistent/stockfish');
		engine.quit();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(true).toBe(true);
	});
});
