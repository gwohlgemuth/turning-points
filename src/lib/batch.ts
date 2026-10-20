import { findTurningPoints, type Move, type PositionEval, type Side } from './analysis.ts';
import { markNoTurningPoints } from './games.ts';
import { emptyNotes, writeNotes } from './notes.ts';
import backend from '#backend';

export type GameAnalysis = {
	startFen: string;
	moves: Move[];
	headers: Record<string, string>;
	evals: PositionEval[];
};

export function markTurningPoints(
	pgn: string,
	evals: PositionEval[],
	count: number,
	side: Side
): string {
	const turningPoints = findTurningPoints(
		evals.map((e) => e.winPercent),
		count,
		side
	);
	const marked = writeNotes(
		pgn,
		Object.fromEntries(turningPoints.map((tp) => [tp.ply, emptyNotes()]))
	);
	return markNoTurningPoints(marked, !turningPoints.length);
}

export async function analyzeGame(
	pgn: string,
	depth: number,
	signal: AbortSignal
): Promise<GameAnalysis> {
	const result: GameAnalysis = { startFen: '', moves: [], headers: {}, evals: [] };
	await backend.analyze(pgn, depth, signal, (event) => {
		if (event.type === 'start') {
			const { startFen, moves, headers } = event;
			Object.assign(result, { startFen, moves, headers });
		}
		if (event.type === 'eval') result.evals[event.eval.index] = event.eval;
		if (event.type === 'error') throw new Error(event.message);
	});
	if (result.evals.length !== result.moves.length + 1 || !result.evals.every(Boolean)) {
		throw new Error('The analysis did not finish');
	}
	return result;
}
