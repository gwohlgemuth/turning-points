import { describe, it, expect } from 'vitest';
import { parseGame, type AnalyzeEvent } from './analysis.ts';
import {
	analyzeGame,
	clampElo,
	Engine,
	engineMove,
	parseBestMove,
	parseInfo,
	type Transport
} from './engine.ts';

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

describe('parseBestMove', () => {
	it('reads the best move', () => {
		expect(parseBestMove('bestmove e2e4')).toBe('e2e4');
		expect(parseBestMove('bestmove e7e8q ponder d1d8')).toBe('e7e8q');
	});

	it('returns null when there is no move', () => {
		expect(parseBestMove('bestmove (none)')).toBeNull();
		expect(parseBestMove('info depth 1 score cp 0 pv e2e4')).toBeNull();
	});
});

describe('clampElo', () => {
	it('keeps the Elo within the range Stockfish supports', () => {
		expect(clampElo(1000)).toBe(1320);
		expect(clampElo(4000)).toBe(3190);
		expect(clampElo('2000')).toBe(2000);
		expect(clampElo(undefined)).toBe(1500);
	});
});

function fakeTransport(reply: (command: string) => string[]): Transport {
	let listener: (line: string) => void = () => {};
	return {
		send: (command) => queueMicrotask(() => reply(command).forEach((line) => listener(line))),
		onLine: (next) => (listener = next),
		exited: new Promise<never>(() => {}),
		kill: () => {}
	};
}

const stockfishReply = (command: string) => {
	if (command === 'uci') return ['uciok'];
	if (command === 'isready') return ['readyok'];
	if (command.startsWith('go')) return ['info depth 8 score cp 25 pv e2e4', 'bestmove e2e4'];
	return [];
};

describe('analyzeGame', () => {
	it('emits the game, one evaluation per position and done', async () => {
		const events: AnalyzeEvent[] = [];
		const engine = new Engine(fakeTransport(stockfishReply));
		await analyzeGame(
			engine,
			1,
			parseGame('1. e4 e5'),
			8,
			(e) => events.push(e),
			() => false
		);
		expect(events.map((e) => e.type)).toEqual(['start', 'eval', 'eval', 'eval', 'done']);
		expect(events[2]).toMatchObject({ eval: { index: 1, score: { type: 'cp', value: -25 } } });
	});

	it('reports engine failures as an error event', async () => {
		const events: AnalyzeEvent[] = [];
		const transport = fakeTransport(() => []);
		transport.exited = Promise.reject(new Error('Stockfish exited (code 1)'));
		await analyzeGame(
			new Engine(transport),
			1,
			parseGame('1. e4'),
			8,
			(e) => events.push(e),
			() => false
		);
		expect(events.at(-1)).toEqual({ type: 'error', message: 'Stockfish exited (code 1)' });
	});
});

describe('engineMove', () => {
	it('returns the best move in UCI and SAN', async () => {
		const engine = new Engine(fakeTransport(stockfishReply));
		const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		expect(await engineMove(engine, 1, start, 1500)).toEqual({ uci: 'e2e4', san: 'e4' });
	});
});
