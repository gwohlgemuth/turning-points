import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Score } from '#lib/analysis.ts';

export type EngineResult = {
	score: Score;
	bestMove: string | null;
	pv: string[];
};

export function parseInfo(line: string): { score: Score; pv: string[] } | null {
	const tokens = line.split(' ');
	if (tokens[0] !== 'info') return null;
	const i = tokens.indexOf('score');
	if (i < 0) return null;
	const bound = tokens[i + 3];
	if (bound === 'lowerbound' || bound === 'upperbound') return null;
	const type = tokens[i + 1];
	if (type !== 'cp' && type !== 'mate') return null;
	const pvIndex = tokens.indexOf('pv');
	return {
		score: { type, value: Number(tokens[i + 2]) },
		pv: pvIndex < 0 ? [] : tokens.slice(pvIndex + 1)
	};
}

export class Stockfish {
	#proc: ChildProcessWithoutNullStreams;
	#listener: ((line: string) => void) | null = null;
	#exited: Promise<never>;

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

	async analyse(fen: string, depth: number): Promise<EngineResult> {
		this.#send(`position fen ${fen}`);
		let last: { score: Score; pv: string[] } | null = null;
		const bestLine = await this.#request(`go depth ${depth}`, (line) => {
			last = parseInfo(line) ?? last;
			return line.startsWith('bestmove');
		});
		const bestMove = bestLine.split(' ')[1];
		const { score, pv } = last ?? { score: { type: 'cp', value: 0 } as Score, pv: [] };
		return { score, pv, bestMove: bestMove === '(none)' ? null : bestMove };
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
