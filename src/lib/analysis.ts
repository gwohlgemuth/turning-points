import { Chess } from 'chess.js';
import type { MoveTime } from './clock.ts';

export type Score = { type: 'cp' | 'mate'; value: number };

export type Side = 'w' | 'b';

export type PositionEval = {
	index: number;
	score: Score;
	winPercent: number;
	best?: string;
};

export type Arrow = { from: string; to: string; kind: 'best' | 'candidate' | 'game' };

export type Variation = { score: Score; moves: string[] };

export type Move = {
	ply: number;
	san: string;
	from: string;
	to: string;
	fenBefore: string;
	fenAfter: string;
	time: MoveTime | null;
};

export type TurningPoint = {
	ply: number;
	before: number;
	after: number;
	delta: number;
};

export type AnalyzeEvent =
	| { type: 'start'; startFen: string; moves: Move[]; headers: Record<string, string> }
	| { type: 'eval'; eval: PositionEval }
	| { type: 'done' }
	| { type: 'error'; message: string };

export function cpToWinPercent(cp: number): number {
	return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function winPercent(score: Score, whiteToMove: boolean): number {
	if (score.type === 'cp') return cpToWinPercent(score.value);
	if (score.value === 0) return whiteToMove ? 0 : 100;
	return score.value > 0 ? 100 : 0;
}

export function toWhitePerspective(score: Score, whiteToMove: boolean): Score {
	if (whiteToMove) return score;
	return { type: score.type, value: -score.value };
}

export function formatScore(score: Score): string {
	if (score.type === 'mate') {
		if (score.value === 0) return '#';
		return `${score.value > 0 ? '' : '-'}M${Math.abs(score.value)}`;
	}
	const pawns = score.value / 100;
	return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

export const TURNING_POINTS = 3;

export function findTurningPoints(winPercents: number[], n: number, side: Side): TurningPoint[] {
	const sign = side === 'w' ? 1 : -1;
	const swings: TurningPoint[] = [];
	for (let ply = side === 'w' ? 1 : 2; ply < winPercents.length; ply += 2) {
		const before = winPercents[ply - 1];
		const after = winPercents[ply];
		swings.push({ ply, before, after, delta: sign * (after - before) });
	}
	return swings
		.filter((s) => s.delta !== 0)
		.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
		.slice(0, Math.max(0, n))
		.sort((a, b) => a.ply - b.ply);
}

export type Judgement = { symbol: '?!' | '?' | '??'; name: 'inaccuracy' | 'mistake' | 'blunder' };

export function judgeMove(delta: number): Judgement | null {
	if (delta <= -15) return { symbol: '??', name: 'blunder' };
	if (delta <= -10) return { symbol: '?', name: 'mistake' };
	if (delta <= -5) return { symbol: '?!', name: 'inaccuracy' };
	return null;
}

const FOUND_MARGIN = 5;

export function foundBetterMove(best: number, candidate: number, side: Side): boolean {
	const sign = side === 'w' ? 1 : -1;
	return sign * (best - candidate) <= FOUND_MARGIN;
}

export function moveSquares(fen: string, san: string): { from: string; to: string } | null {
	try {
		const { from, to } = new Chess(fen).move(san);
		return { from, to };
	} catch {
		return null;
	}
}

export const uciSquares = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

export function moveLabel(ply: number, san: string): string {
	const moveNumber = Math.ceil(ply / 2);
	return ply % 2 === 1 ? `${moveNumber}. ${san}` : `${moveNumber}… ${san}`;
}

export function formatLine(fen: string, moves: string[]): string {
	const [, turn, , , , fullmove] = fen.split(' ');
	let number = Number(fullmove) || 1;
	let whiteToMove = turn === 'w';
	return moves
		.map((san, i) => {
			const text = whiteToMove ? `${number}. ${san}` : i === 0 ? `${number}… ${san}` : san;
			if (!whiteToMove) number++;
			whiteToMove = !whiteToMove;
			return text;
		})
		.join(' ');
}
