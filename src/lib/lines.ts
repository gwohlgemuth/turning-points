import { Chess } from 'chess.js';
import type { Score, Variation } from './analysis.ts';

export async function fetchLines(
	fen: string,
	depth: number,
	lines: number,
	signal: AbortSignal
): Promise<Variation[]> {
	const response = await fetch('/api/lines', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ fen, depth, lines }),
		signal
	});
	const body = await response.json();
	if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
	return body.variations;
}

export async function fetchScore(fen: string, depth: number, signal: AbortSignal): Promise<Score> {
	const chess = new Chess(fen);
	if (chess.isCheckmate()) return { type: 'mate', value: 0 };
	if (chess.isGameOver()) return { type: 'cp', value: 0 };
	const [line] = await fetchLines(fen, depth, 1, signal);
	return line.score;
}
