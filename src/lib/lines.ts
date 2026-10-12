import { Chess } from 'chess.js';
import backend from '#backend';
import type { Score } from './analysis.ts';

export async function fetchScore(fen: string, depth: number, signal: AbortSignal): Promise<Score> {
	const chess = new Chess(fen);
	if (chess.isCheckmate()) return { type: 'mate', value: 0 };
	if (chess.isGameOver()) return { type: 'cp', value: 0 };
	const [line] = await backend.lines(fen, depth, 1, signal);
	return line.score;
}
