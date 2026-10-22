import engineScript from 'stockfish/bin/stockfish-19-lite-single.js?url';
import engineWasm from 'stockfish/bin/stockfish-19-lite-single.wasm?url';
import { parseGame } from '../analysis.ts';
import { demo, demoKey } from '../demo/mode.ts';
import { analyzeGame, clampDepth, Engine, engineLines, engineMove } from '../engine.ts';
import { candidateNames, pgnFilename, sameGame, splitPgn } from '../games.ts';
import { mergeReviewState, parseReviewState } from '../review.ts';
import { fetchLichessGames } from '../sources.ts';
import { savedGames } from '../stats.ts';
import {
	filesToWrite,
	isGameList,
	formatReview,
	formatSync,
	parseSync,
	recordReview,
	reviewData,
	scheduleMissed,
	statsData
} from './shared.ts';
import type { Backend, PgnFile } from './types.ts';

function createEngine(): Engine {
	const wasm = new URL(engineWasm, location.href).href;
	const worker = new Worker(`${engineScript}#${encodeURIComponent(wasm)}`);
	let stop: (err: Error) => void = () => {};
	const exited = new Promise<never>((_, reject) => (stop = reject));
	worker.onerror = (event) => stop(new Error(`Stockfish failed: ${event.message}`));
	return new Engine({
		send: (command) => worker.postMessage(command),
		onLine: (listener) => (worker.onmessage = (event) => listener(String(event.data))),
		exited,
		kill: () => {
			worker.terminate();
			stop(new Error('Stockfish stopped'));
		}
	});
}

async function withEngine<T>(signal: AbortSignal, run: (engine: Engine) => Promise<T>) {
	signal.throwIfAborted();
	const engine = createEngine();
	const abort = () => engine.quit();
	signal.addEventListener('abort', abort);
	try {
		return await run(engine);
	} catch (err) {
		signal.throwIfAborted();
		throw err;
	} finally {
		signal.removeEventListener('abort', abort);
		engine.quit();
	}
}

const THREADS = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	database ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(demoKey('turning-points', demo.active), 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore('files', { keyPath: 'path' });
			req.result.createObjectStore('meta');
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return database;
}

async function store(name: 'files' | 'meta', mode: IDBTransactionMode = 'readonly') {
	return (await open()).transaction(name, mode).objectStore(name);
}

const allFiles = async () => request<PgnFile[]>((await store('files')).getAll());
const deleteFile = async (path: string) =>
	request((await store('files', 'readwrite')).delete(path));

async function removeGameLists() {
	for (const file of (await allFiles()).filter(isGameList)) await deleteFile(file.path);
}

let cleanup: Promise<void> | null = null;

async function readFiles() {
	cleanup ??= removeGameLists();
	await cleanup;
	return allFiles();
}
const writeFile = async (file: PgnFile) => request((await store('files', 'readwrite')).put(file));
const readReview = async () =>
	(await request<string | undefined>((await store('meta')).get('review'))) ?? '{}';
const writeReview = async (text: string) =>
	request((await store('meta', 'readwrite')).put(text, 'review'));

async function saveFile(text: string, filename: string, replaceSameGame: boolean) {
	const existing = new Map((await readFiles()).map((file) => [file.path, file.text]));
	for (const path of candidateNames(filename)) {
		const current = existing.get(path);
		if (current === undefined || (replaceSameGame && sameGame(current, text))) {
			await writeFile({ path, text });
			return path;
		}
	}
	throw new Error('Too many files with this name');
}

const backend: Backend = {
	describe: () => 'this browser',

	async analyze(pgn, depth, signal, onEvent) {
		const game = parseGame(pgn);
		const emit: typeof onEvent = (event) => {
			if (!signal.aborted) onEvent(event);
		};
		await withEngine(signal, (engine) =>
			analyzeGame(engine, THREADS, game, clampDepth(depth), emit, () => signal.aborted)
		);
		signal.throwIfAborted();
	},

	lines: (fen, depth, lines, signal) =>
		withEngine(signal, (engine) => engineLines(engine, THREADS, fen, depth, lines)),

	move: (fen, elo, signal) => withEngine(signal, (engine) => engineMove(engine, THREADS, fen, elo)),

	games: (_source, user, max) => fetchLichessGames(user, max),

	saved: async () => savedGames(await readFiles()),

	async save(_folder, text, filename, replaceSameGame) {
		const path = await saveFile(text, filename, replaceSameGame);
		const state = parseReviewState(await readReview());
		const scheduled = scheduleMissed(state, { path, text });
		if (scheduled) await writeReview(formatReview(state));
		return { path, scheduled };
	},

	async review(_folder, key, found) {
		const state = parseReviewState(await readReview());
		const card = recordReview(state, key, found);
		await writeReview(formatReview(state));
		return card;
	},

	stats: async () => statsData(await readFiles()),

	reviewDeck: async (_folder, today) => reviewData(await readFiles(), await readReview(), today),

	async exportSync() {
		const files = (await readFiles()).sort((a, b) => a.path.localeCompare(b.path));
		return formatSync({ files, review: parseReviewState(await readReview()) });
	},

	async importSync(text) {
		const sync = parseSync(text);
		if (!sync) {
			const games = splitPgn(text);
			for (const game of games) await backend.save('', game + '\n', pgnFilename(game), true);
			return games.length;
		}
		const changed = filesToWrite(await readFiles(), sync.files);
		for (const file of changed) await writeFile(file);
		await writeReview(
			formatReview(mergeReviewState(parseReviewState(await readReview()), sync.review))
		);
		return changed.length;
	},

	deleteGame: deleteFile,

	async deleteAll() {
		await request((await store('files', 'readwrite')).clear());
		await request((await store('meta', 'readwrite')).clear());
	}
};

export default backend;
