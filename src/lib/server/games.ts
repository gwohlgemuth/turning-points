import { pgnHeader, type GameSummary } from '#lib/games.ts';

const USER_AGENT = 'turning-points (local chess analysis app)';
const MAX_CHESSCOM_ARCHIVES = 6;

export class SourceError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

type LichessPlayer = { user?: { name: string }; rating?: number; aiLevel?: number };
type LichessGame = {
	id: string;
	createdAt: number;
	speed: string;
	players: { white: LichessPlayer; black: LichessPlayer };
	pgn: string;
};

type ChessComPlayer = { username: string; rating: number };
type ChessComGame = {
	uuid: string;
	url: string;
	pgn?: string;
	end_time: number;
	time_class: string;
	rules: string;
	white: ChessComPlayer;
	black: ChessComPlayer;
};

function lichessName(player: LichessPlayer): string {
	if (player.user) return player.user.name;
	return player.aiLevel ? `Stockfish level ${player.aiLevel}` : 'Anonymous';
}

export function fromLichess(game: LichessGame): GameSummary {
	return {
		id: game.id,
		url: `https://lichess.org/${game.id}`,
		white: lichessName(game.players.white),
		black: lichessName(game.players.black),
		whiteRating: game.players.white.rating ?? null,
		blackRating: game.players.black.rating ?? null,
		result: pgnHeader(game.pgn, 'Result') ?? '*',
		date: game.createdAt,
		timeClass: game.speed,
		pgn: game.pgn
	};
}

export function fromChessCom(game: ChessComGame & { pgn: string }): GameSummary {
	return {
		id: game.uuid,
		url: game.url,
		white: game.white.username,
		black: game.black.username,
		whiteRating: game.white.rating,
		blackRating: game.black.rating,
		result: pgnHeader(game.pgn, 'Result') ?? '*',
		date: game.end_time * 1000,
		timeClass: game.time_class,
		pgn: game.pgn
	};
}

async function get(url: string, accept = 'application/json'): Promise<Response> {
	const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept } });
	if (response.status === 404) throw new SourceError('User not found', 404);
	if (response.status === 429) {
		throw new SourceError('Too many requests — please wait a minute and try again', 429);
	}
	if (!response.ok) throw new SourceError(`Request failed (${response.status})`, 502);
	return response;
}

export async function fetchLichessGames(username: string, max: number): Promise<GameSummary[]> {
	const params = new URLSearchParams({
		max: String(max),
		pgnInJson: 'true',
		clocks: 'false',
		evals: 'false',
		perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence'
	});
	const response = await get(
		`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
		'application/x-ndjson'
	);
	const text = await response.text();
	return text
		.split('\n')
		.filter((line) => line.trim())
		.map((line) => fromLichess(JSON.parse(line)));
}

export async function fetchChessComGames(username: string, max: number): Promise<GameSummary[]> {
	const base = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
	const { archives } = (await (await get(`${base}/games/archives`)).json()) as {
		archives: string[];
	};
	const games: GameSummary[] = [];
	for (const archive of archives.toReversed().slice(0, MAX_CHESSCOM_ARCHIVES)) {
		const data = (await (await get(archive)).json()) as { games: ChessComGame[] };
		for (const game of data.games.toReversed()) {
			if (game.rules === 'chess' && game.pgn) games.push(fromChessCom({ ...game, pgn: game.pgn }));
		}
		if (games.length >= max) break;
	}
	return games.slice(0, max);
}
