import { error, json } from '@sveltejs/kit';
import { STOCKFISH_PATH, STOCKFISH_THREADS } from '$app/env/private';
import { Chess } from 'chess.js';
import { clampDepth, Stockfish } from '#lib/server/stockfish.ts';
import { toVariation } from '#lib/server/variations.ts';
import type { RequestHandler } from './$types';

const MAX_PLIES = 16;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const fen = String(body.fen ?? '');
	try {
		new Chess(fen);
	} catch (err) {
		error(400, `Invalid FEN: ${(err as Error).message}`);
	}
	const depth = clampDepth(body.depth);
	const multiPv = Math.min(5, Math.max(1, Number(body.lines) || 3));

	const engine = new Stockfish(STOCKFISH_PATH);
	request.signal.addEventListener('abort', () => engine.quit());
	try {
		await engine.init(STOCKFISH_THREADS);
		const lines = await engine.analyse(fen, depth, multiPv);
		return json({ variations: lines.map((line) => toVariation(fen, line, MAX_PLIES)) });
	} catch (err) {
		error(500, (err as Error).message);
	} finally {
		engine.quit();
	}
};
