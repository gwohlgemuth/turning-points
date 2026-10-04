import type { Side } from './analysis.ts';

export type GameSource = 'lichess' | 'chesscom';

export const GAME_COUNTS = [10, 20, 50] as const;

export type GameSummary = {
	id: string;
	url: string;
	white: string;
	black: string;
	whiteRating: number | null;
	blackRating: number | null;
	result: string;
	date: number;
	timeClass: string;
	pgn: string;
};

export function playerSide(game: GameSummary, username: string): Side | null {
	const name = username.trim().toLowerCase();
	if (game.white.toLowerCase() === name) return 'w';
	if (game.black.toLowerCase() === name) return 'b';
	return null;
}
