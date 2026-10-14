import { BackendError } from './shared.ts';
import type { Backend } from './types.ts';

async function request(url: string, init?: RequestInit) {
	const response = await fetch(url, init);
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new BackendError(body.message ?? `Request failed (${response.status})`, response.status);
	}
	return body;
}

const post = (url: string, data: unknown, signal?: AbortSignal) =>
	request(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data),
		signal
	});

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

const backend: Backend = {
	describe: (path) => (path ? `~/${path}` : '~'),

	async analyze(pgn, depth, signal, onEvent) {
		const response = await fetch('/api/analyze', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pgn, depth }),
			signal
		});
		if (!response.ok || !response.body) {
			const body = await response.json().catch(() => ({}));
			throw new Error(body.message ?? `Request failed (${response.status})`);
		}
		const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
		let buffer = '';
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += value;
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
		}
	},

	async lines(fen, depth, lines, signal) {
		return (await post('/api/lines', { fen, depth, lines }, signal)).variations;
	},

	move: (fen, elo, signal) => post('/api/move', { fen, elo }, signal),

	async games(source, user, max) {
		return (await request(`/api/games?${query({ source, user, max: String(max) })}`)).games;
	},

	async saved(folder) {
		return (await request(`/api/saved?${query({ folder })}`)).games;
	},

	save: (folder, text, filename, replaceSameGame) =>
		post('/api/save', { folder, filename, text, replaceSameGame }),

	review: (folder, key, found) => post('/api/review', { folder, key, found }),

	stats: (folder) => request(`/api/stats?${query({ folder })}`),

	reviewDeck: (folder, today) =>
		request(`/api/review?${query(today ? { folder, today } : { folder })}`),

	listFolders: (path) => request(`/api/folders?${query({ path })}`),

	async createFolder(parent, name) {
		return (await post('/api/folders', { parent, name })).path;
	}
};

export default backend;
