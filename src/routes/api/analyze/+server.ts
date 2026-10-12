import { error } from '@sveltejs/kit';
import { STOCKFISH_PATH, STOCKFISH_THREADS } from '$app/env/private';
import { parseGame, type AnalyzeEvent, type ParsedGame } from '#lib/analysis.ts';
import { analyzeGame, clampDepth } from '#lib/engine.ts';
import { createStockfish } from '#lib/server/stockfish.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const depth = clampDepth(body.depth);
	let game: ParsedGame;
	try {
		game = parseGame(String(body.pgn ?? ''));
	} catch (err) {
		error(400, (err as Error).message);
	}

	const engine = createStockfish(STOCKFISH_PATH);
	const encoder = new TextEncoder();
	let cancelled = false;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = (event: AnalyzeEvent) =>
				controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			await analyzeGame(engine, STOCKFISH_THREADS, game, depth, emit, () => cancelled);
			engine.quit();
			if (!cancelled) controller.close();
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
