export type Score = { type: 'cp' | 'mate'; value: number };

export type PositionEval = {
	index: number;
	score: Score;
	winPercent: number;
	bestMove: string | null;
	pv: string[];
};

export type Move = {
	ply: number;
	san: string;
	from: string;
	to: string;
	fenBefore: string;
	fenAfter: string;
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

export function findTurningPoints(winPercents: number[], n: number): TurningPoint[] {
	const swings: TurningPoint[] = [];
	for (let ply = 1; ply < winPercents.length; ply++) {
		const before = winPercents[ply - 1];
		const after = winPercents[ply];
		swings.push({ ply, before, after, delta: after - before });
	}
	return swings
		.filter((s) => s.delta !== 0)
		.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
		.slice(0, Math.max(0, n))
		.sort((a, b) => a.ply - b.ply);
}

export function moveLabel(ply: number, san: string): string {
	const moveNumber = Math.ceil(ply / 2);
	return ply % 2 === 1 ? `${moveNumber}. ${san}` : `${moveNumber}… ${san}`;
}
