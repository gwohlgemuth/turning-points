import { error } from '@sveltejs/kit';
import { STOCKFISH_PATH, STOCKFISH_THREADS } from '$app/env/private';
import { Chess } from 'chess.js';
import { toWhitePerspective, winPercent, type AnalyzeEvent, type Move } from '#lib/analysis.ts';
import { Stockfish } from '#lib/server/stockfish.ts';
import type { RequestHandler } from './$types';

const MIN_DEPTH = 6;
const MAX_DEPTH = 30;

function parseGame(pgn: string) {
	const chess = new Chess();
	try {
		chess.loadPgn(pgn);
	} catch (err) {
		error(400, `Invalid PGN: ${(err as Error).message}`);
	}
	const history = chess.history({ verbose: true });
	if (history.length === 0) error(400, 'The PGN contains no moves');
	const moves: Move[] = history.map((m, i) => ({
		ply: i + 1,
		san: m.san,
		from: m.from,
		to: m.to,
		fenBefore: m.before,
		fenAfter: m.after
	}));
	return { startFen: history[0].before, moves, headers: chess.getHeaders() };
}

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

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const depth = Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, Number(body.depth) || 16));
	const game = parseGame(String(body.pgn ?? ''));
	const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];

	const engine = new Stockfish(STOCKFISH_PATH);
	const encoder = new TextEncoder();
	let cancelled = false;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = (event: AnalyzeEvent) =>
				controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			try {
				emit({ type: 'start', ...game });
				await engine.init(STOCKFISH_THREADS);
				for (const [index, fen] of fens.entries()) {
					if (cancelled) return;
					const result = await engine.analyse(fen, depth);
					const whiteToMove = fen.split(' ')[1] === 'w';
					const score = toWhitePerspective(result.score, whiteToMove);
					const pv = uciToSan(fen, result.pv.length ? result.pv : [result.bestMove ?? '']);
					emit({
						type: 'eval',
						eval: {
							index,
							score,
							winPercent: winPercent(score, whiteToMove),
							bestMove: pv[0] ?? null,
							pv: pv.slice(0, 8)
						}
					});
				}
				emit({ type: 'done' });
			} catch (err) {
				emit({ type: 'error', message: (err as Error).message });
			} finally {
				engine.quit();
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			engine.quit();
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }
	});
};
