import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Engine } from '#lib/engine.ts';

export function createStockfish(path: string): Engine {
	const proc = spawn(path, [], { stdio: 'pipe' });
	const exited = new Promise<never>((_, reject) => {
		proc.on('error', (err) =>
			reject(new Error(`Could not start Stockfish at "${path}": ${err.message}`))
		);
		proc.on('exit', (code) => reject(new Error(`Stockfish exited (code ${code})`)));
	});
	proc.stdin.on('error', () => {});
	const lines = createInterface({ input: proc.stdout });
	return new Engine({
		send: (command) => {
			if (proc.stdin.writable) proc.stdin.write(command + '\n');
		},
		onLine: (listener) => lines.on('line', listener),
		exited,
		kill: () => setTimeout(() => proc.kill(), 500).unref()
	});
}
