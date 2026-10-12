import { error, json } from '@sveltejs/kit';
import { STOCKFISH_PATH, STOCKFISH_THREADS } from '$app/env/private';
import { Chess } from 'chess.js';
import { engineLines } from '#lib/engine.ts';
import { createStockfish } from '#lib/server/stockfish.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const fen = String(body.fen ?? '');
	try {
		new Chess(fen);
	} catch (err) {
		error(400, `Invalid FEN: ${(err as Error).message}`);
	}

	const engine = createStockfish(STOCKFISH_PATH);
	request.signal.addEventListener('abort', () => engine.quit());
	try {
		const variations = await engineLines(engine, STOCKFISH_THREADS, fen, body.depth, body.lines);
		return json({ variations });
	} catch (err) {
		error(500, (err as Error).message);
	} finally {
		engine.quit();
	}
};
