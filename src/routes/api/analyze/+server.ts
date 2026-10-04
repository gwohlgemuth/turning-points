import { error } from '@sveltejs/kit';
import { STOCKFISH_PATH, STOCKFISH_THREADS } from '$app/env/private';
import { Chess } from 'chess.js';
import { toWhitePerspective, winPercent, type AnalyzeEvent, type Move } from '#lib/analysis.ts';
import { clampDepth, Stockfish } from '#lib/server/stockfish.ts';
import { isWhiteToMove } from '#lib/server/variations.ts';
import type { RequestHandler } from './$types';

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

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const depth = clampDepth(body.depth);
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
					const [line] = await engine.analyse(fen, depth);
					const whiteToMove = isWhiteToMove(fen);
					const score = toWhitePerspective(line.score, whiteToMove);
					emit({
						type: 'eval',
						eval: { index, score, winPercent: winPercent(score, whiteToMove) }
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
