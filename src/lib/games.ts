import { Chess } from 'chess.js';
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

export const gameRef = (game: GameSummary) => game.url || game.id;

export function winner(result: string): Side | 'draw' | null {
	if (result === '1-0') return 'w';
	if (result === '0-1') return 'b';
	if (result === '1/2-1/2') return 'draw';
	return null;
}

export type Outcome = 'win' | 'loss' | 'draw';

export function gameOutcome(game: GameSummary, perspective: string): Outcome | null {
	const won = winner(game.result);
	const side = playerSide(game, perspective);
	if (!won || !side) return null;
	if (won === 'draw') return 'draw';
	return won === side ? 'win' : 'loss';
}

export const formatGameDate = (date: number) => (date ? new Date(date).toLocaleDateString() : '');

export function filterGames<T extends GameSummary>(
	games: T[],
	query: string,
	outcome: Outcome | '',
	perspective: string
): T[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	return games.filter((game) => {
		if (outcome && gameOutcome(game, perspective) !== outcome) return false;
		const text = `${game.white} ${game.black} ${formatGameDate(game.date)}`.toLowerCase();
		return words.every((word) => text.includes(word));
	});
}

export function mergeAdjacentComments(pgn: string): string {
	return pgn.replace(/\}\s*\{/g, ' ');
}

export function pgnHeader(pgn: string, name: string): string | undefined {
	return new RegExp(`\\[${name} "([^"]*)"\\]`).exec(pgn)?.[1];
}

export function writeHeader(pgn: string, name: string, value: string | null): string {
	const header = new RegExp(`^\\[${name} "[^"]*"\\]\\n?`, 'm');
	const line = value === null ? '' : `[${name} "${value}"]\n`;
	if (header.test(pgn)) return pgn.replace(header, line);
	if (!line) return pgn;
	if (!pgn.trimStart().startsWith('[')) return `${line}\n${pgn}`;
	return pgn.replace(/^((?:\s*\[[^\n]*\]\n)*)/, `$1${line}`);
}

const TURNING_POINTS_HEADER = 'TurningPoints';

export const hasNoTurningPoints = (pgn: string) => pgnHeader(pgn, TURNING_POINTS_HEADER) === '0';

export const markNoTurningPoints = (pgn: string, none: boolean) =>
	writeHeader(pgn, TURNING_POINTS_HEADER, none ? '0' : null);

export function gameUrl(pgn: string): string | undefined {
	const url = pgnHeader(pgn, 'Link') ?? pgnHeader(pgn, 'Site');
	return url?.startsWith('http') ? url : undefined;
}

function mainline(pgn: string): string | null {
	const chess = new Chess();
	try {
		chess.loadPgn(mergeAdjacentComments(pgn));
	} catch {
		return null;
	}
	const players = [pgnHeader(pgn, 'White'), pgnHeader(pgn, 'Black')];
	return [...players, ...chess.history()].join(' ');
}

export function gameKey(pgn: string): string | null {
	return gameUrl(pgn) ?? mainline(pgn);
}

export function sameGame(a: string, b: string): boolean {
	if (splitPgn(a).length !== 1 || splitPgn(b).length !== 1) return false;
	const [urlA, urlB] = [gameUrl(a), gameUrl(b)];
	if (urlA && urlB) return urlA === urlB;
	const moves = mainline(a);
	return moves !== null && moves === mainline(b);
}

export function gamesToPgn(games: GameSummary[]): string {
	return games.map((game) => game.pgn.trim()).join('\n\n') + '\n';
}

export function splitPgn(text: string): string[] {
	return text
		.replace(/\r\n/g, '\n')
		.split(/\n\s*\n(?=\s*\[)/)
		.map((part) => part.trim())
		.filter(Boolean);
}

export function playersByCount(games: GameSummary[]): string[] {
	const counts = new Map<string, number>();
	for (const { white, black } of games) {
		counts.set(white, (counts.get(white) ?? 0) + 1);
		counts.set(black, (counts.get(black) ?? 0) + 1);
	}
	return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}

const DAY = 86_400_000;

export const formatWhen = (date: number) =>
	!date
		? ''
		: date % DAY
			? new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
			: new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

export const parseRating = (value?: string) =>
	value && /^\d+$/.test(value) ? Number(value) : null;

export function summaryFromPgn(pgn: string, index: number): GameSummary {
	const utcDay = pgnHeader(pgn, 'UTCDate');
	const day = (utcDay ?? pgnHeader(pgn, 'Date') ?? '').replaceAll('.', '-');
	const time = utcDay ? pgnHeader(pgn, 'UTCTime') : undefined;
	const date = Date.parse(time && /^\d\d:\d\d:\d\d$/.test(time) ? `${day}T${time}Z` : day);
	return {
		id: `file-${index}`,
		url: '',
		white: pgnHeader(pgn, 'White') ?? '?',
		black: pgnHeader(pgn, 'Black') ?? '?',
		whiteRating: parseRating(pgnHeader(pgn, 'WhiteElo')),
		blackRating: parseRating(pgnHeader(pgn, 'BlackElo')),
		result: pgnHeader(pgn, 'Result') ?? '*',
		date: Number.isNaN(date) ? 0 : date,
		timeClass: '',
		pgn
	};
}

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export function pgnFilename(pgn: string): string {
	const clean = (value?: string) =>
		value && !/^\?*$/.test(value) ? value.replace(/[^\p{L}\p{N}_-]+/gu, '_') : '';
	const white = clean(pgnHeader(pgn, 'White'));
	const black = clean(pgnHeader(pgn, 'Black'));
	if (!white || !black) return `game-${today()}.pgn`;
	const date = pgnHeader(pgn, 'UTCDate') ?? pgnHeader(pgn, 'Date') ?? '';
	const suffix = /^\d{4}\.\d{2}\.\d{2}$/.test(date) ? `-${date.replaceAll('.', '-')}` : '';
	return `${white}-vs-${black}${suffix}.pgn`;
}

export function candidateNames(filename: string): string[] {
	const stem = filename.replace(/\.pgn$/i, '');
	return Array.from({ length: 999 }, (_, i) => (i === 0 ? filename : `${stem} (${i + 1}).pgn`));
}
