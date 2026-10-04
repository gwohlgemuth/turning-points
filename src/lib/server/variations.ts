import { Chess } from 'chess.js';
import { toWhitePerspective, type Variation } from '#lib/analysis.ts';
import type { EngineLine } from './stockfish.ts';

function uciToSan(fen: string, uci: string[]): string[] {
	const chess = new Chess(fen);
	const san: string[] = [];
	for (const move of uci) {
		try {
			san.push(
				chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }).san
			);
		} catch {
			break;
		}
	}
	return san;
}

export function isWhiteToMove(fen: string): boolean {
	return fen.split(' ')[1] === 'w';
}

export function toVariation(fen: string, line: EngineLine, maxPlies: number): Variation {
	return {
		score: toWhitePerspective(line.score, isWhiteToMove(fen)),
		moves: uciToSan(fen, line.pv.slice(0, maxPlies))
	};
}
