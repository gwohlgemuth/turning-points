import { error, json } from '@sveltejs/kit';
import { GAME_COUNTS } from '#lib/games.ts';
import { fetchChessComGames, fetchLichessGames, SourceError } from '#lib/sources.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const source = url.searchParams.get('source');
	const username = url.searchParams.get('user')?.trim() ?? '';
	if (!/^[\w-]{1,30}$/.test(username)) error(400, 'Invalid username');
	if (source !== 'lichess' && source !== 'chesscom') error(400, 'Unknown source');
	const max = Number(url.searchParams.get('max') ?? 20);
	if (!GAME_COUNTS.some((count) => count === max)) error(400, 'Invalid number of games');

	try {
		const games =
			source === 'lichess'
				? await fetchLichessGames(username, max)
				: await fetchChessComGames(username, max);
		return json({ games });
	} catch (err) {
		if (err instanceof SourceError) error(err.status, err.message);
		throw err;
	}
};
