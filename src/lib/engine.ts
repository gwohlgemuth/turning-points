import { Chess } from 'chess.js';
import {
	isWhiteToMove,
	toWhitePerspective,
	winPercent,
	type AnalyzeEvent,
	type ParsedGame,
	type Score,
	type Variation
} from './analysis.ts';
import { toVariation } from './variations.ts';

export type EngineLine = { score: Score; pv: string[] };

export type Transport = {
	send(command: string): void;
	onLine(listener: (line: string) => void): void;
	exited: Promise<never>;
	kill(): void;
};

export function clampDepth(value: unknown): number {
	return Math.min(30, Math.max(6, Number(value) || 16));
}

export function clampElo(value: unknown): number {
	return Math.min(3190, Math.max(1320, Number(value) || 1500));
}

export function parseBestMove(line: string): string | null {
	const [command, move] = line.split(' ');
	if (command !== 'bestmove' || !move || move === '(none)') return null;
	return move;
}

export function parseInfo(line: string): (EngineLine & { multipv: number }) | null {
	const tokens = line.split(' ');
	if (tokens[0] !== 'info') return null;
	const i = tokens.indexOf('score');
	if (i < 0) return null;
	const bound = tokens[i + 3];
	if (bound === 'lowerbound' || bound === 'upperbound') return null;
	const type = tokens[i + 1];
	if (type !== 'cp' && type !== 'mate') return null;
	const pvIndex = tokens.indexOf('pv');
	const multipvIndex = tokens.indexOf('multipv');
	return {
		multipv: multipvIndex < 0 ? 1 : Number(tokens[multipvIndex + 1]),
		score: { type, value: Number(tokens[i + 2]) },
		pv: pvIndex < 0 ? [] : tokens.slice(pvIndex + 1)
	};
}

export class Engine {
	#transport: Transport;
	#listener: ((line: string) => void) | null = null;
	#multiPv = 1;
	#quit = false;

	constructor(transport: Transport) {
		this.#transport = transport;
		transport.exited.catch(() => {});
		transport.onLine((line) => this.#listener?.(line));
	}

	async init(threads: number): Promise<void> {
		await this.#request('uci', (line) => line === 'uciok');
		this.#transport.send(`setoption name Threads value ${threads}`);
		await this.#request('isready', (line) => line === 'readyok');
	}

	async analyse(fen: string, depth: number, multiPv = 1): Promise<EngineLine[]> {
		if (multiPv !== this.#multiPv) {
			this.#transport.send(`setoption name MultiPV value ${multiPv}`);
			this.#multiPv = multiPv;
		}
		this.#transport.send(`position fen ${fen}`);
		const lines: EngineLine[] = [];
		await this.#request(`go depth ${depth}`, (line) => {
			const info = parseInfo(line);
			if (info) lines[info.multipv - 1] = { score: info.score, pv: info.pv };
			return line.startsWith('bestmove');
		});
		const result = lines.filter(Boolean);
		return result.length ? result : [{ score: { type: 'cp', value: 0 }, pv: [] }];
	}

	async bestMove(fen: string, elo: number, movetime: number): Promise<string | null> {
		this.#transport.send('setoption name UCI_LimitStrength value true');
		this.#transport.send(`setoption name UCI_Elo value ${elo}`);
		this.#transport.send(`position fen ${fen}`);
		const line = await this.#request(`go movetime ${movetime}`, (l) => l.startsWith('bestmove'));
		return parseBestMove(line);
	}

	quit(): void {
		if (this.#quit) return;
		this.#quit = true;
		this.#transport.send('quit');
		this.#transport.kill();
	}

	#request(command: string, isDone: (line: string) => boolean): Promise<string> {
		const response = new Promise<string>((resolve) => {
			this.#listener = (line) => {
				if (!isDone(line)) return;
				this.#listener = null;
				resolve(line);
			};
		});
		this.#transport.send(command);
		return Promise.race([response, this.#transport.exited]);
	}
}

export async function analyzeGame(
	engine: Engine,
	threads: number,
	game: ParsedGame,
	depth: number,
	emit: (event: AnalyzeEvent) => void,
	isCancelled: () => boolean
): Promise<void> {
	const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];
	try {
		emit({ type: 'start', ...game });
		await engine.init(threads);
		for (const [index, fen] of fens.entries()) {
			if (isCancelled()) return;
			const [line] = await engine.analyse(fen, depth);
			const whiteToMove = isWhiteToMove(fen);
			const score = toWhitePerspective(line.score, whiteToMove);
			emit({
				type: 'eval',
				eval: { index, score, winPercent: winPercent(score, whiteToMove), best: line.pv[0] }
			});
		}
		emit({ type: 'done' });
	} catch (err) {
		emit({ type: 'error', message: (err as Error).message });
	}
}

const MAX_PLIES = 16;

export async function engineLines(
	engine: Engine,
	threads: number,
	fen: string,
	depth: number,
	lines: number
): Promise<Variation[]> {
	const multiPv = Math.min(5, Math.max(1, Number(lines) || 3));
	await engine.init(threads);
	const result = await engine.analyse(fen, clampDepth(depth), multiPv);
	return result.map((line) => toVariation(fen, line, MAX_PLIES));
}

const MOVETIME = 500;

export type EngineMove = { uci: string; san: string } | { uci: null };

export async function engineMove(
	engine: Engine,
	threads: number,
	fen: string,
	elo: number
): Promise<EngineMove> {
	await engine.init(threads);
	const uci = await engine.bestMove(fen, clampElo(elo), MOVETIME);
	if (!uci) return { uci: null };
	const move = new Chess(fen).move({
		from: uci.slice(0, 2),
		to: uci.slice(2, 4),
		promotion: uci[4]
	});
	return { uci, san: move.san };
}
