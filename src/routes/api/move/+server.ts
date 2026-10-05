import { error, json } from '@sveltejs/kit';
import { STOCKFISH_PATH, STOCKFISH_THREADS } from '$app/env/private';
import { Chess } from 'chess.js';
import { clampElo, Stockfish } from '#lib/server/stockfish.ts';
import type { RequestHandler } from './$types';

const MOVETIME = 500;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const fen = String(body.fen ?? '');
	let chess: Chess;
	try {
		chess = new Chess(fen);
	} catch (err) {
		error(400, `Invalid FEN: ${(err as Error).message}`);
	}
	const elo = clampElo(body.elo);

	const engine = new Stockfish(STOCKFISH_PATH);
	request.signal.addEventListener('abort', () => engine.quit());
	try {
		await engine.init(STOCKFISH_THREADS);
		const uci = await engine.bestMove(fen, elo, MOVETIME);
		if (!uci) return json({ uci: null });
		const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
		return json({ uci, san: move.san });
	} catch (err) {
		error(500, (err as Error).message);
	} finally {
		engine.quit();
	}
};
