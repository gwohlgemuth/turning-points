import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Score } from '#lib/analysis.ts';

export type EngineLine = { score: Score; pv: string[] };

export function clampDepth(value: unknown): number {
	return Math.min(30, Math.max(6, Number(value) || 16));
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

export class Stockfish {
	#proc: ChildProcessWithoutNullStreams;
	#listener: ((line: string) => void) | null = null;
	#exited: Promise<never>;
	#multiPv = 1;

	constructor(path: string) {
		this.#proc = spawn(path, [], { stdio: 'pipe' });
		this.#exited = new Promise((_, reject) => {
			this.#proc.on('error', (err) =>
				reject(new Error(`Could not start Stockfish at "${path}": ${err.message}`))
			);
			this.#proc.on('exit', (code) => reject(new Error(`Stockfish exited (code ${code})`)));
		});
		this.#exited.catch(() => {});
		createInterface({ input: this.#proc.stdout }).on('line', (line) => this.#listener?.(line));
	}

	async init(threads: number): Promise<void> {
		await this.#request('uci', (line) => line === 'uciok');
		this.#send(`setoption name Threads value ${threads}`);
		await this.#request('isready', (line) => line === 'readyok');
	}

	async analyse(fen: string, depth: number, multiPv = 1): Promise<EngineLine[]> {
		if (multiPv !== this.#multiPv) {
			this.#send(`setoption name MultiPV value ${multiPv}`);
			this.#multiPv = multiPv;
		}
		this.#send(`position fen ${fen}`);
		const lines: EngineLine[] = [];
		await this.#request(`go depth ${depth}`, (line) => {
			const info = parseInfo(line);
			if (info) lines[info.multipv - 1] = { score: info.score, pv: info.pv };
			return line.startsWith('bestmove');
		});
		const result = lines.filter(Boolean);
		return result.length ? result : [{ score: { type: 'cp', value: 0 }, pv: [] }];
	}

	quit(): void {
		if (this.#proc.exitCode !== null) return;
		this.#send('quit');
		setTimeout(() => this.#proc.kill(), 500).unref();
	}

	#send(command: string): void {
		this.#proc.stdin.write(command + '\n');
	}

	#request(command: string, isDone: (line: string) => boolean): Promise<string> {
		const response = new Promise<string>((resolve) => {
			this.#listener = (line) => {
				if (!isDone(line)) return;
				this.#listener = null;
				resolve(line);
			};
		});
		this.#send(command);
		return Promise.race([response, this.#exited]);
	}
}
