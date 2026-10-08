import { GAME_COUNTS, type GameSource } from './games.ts';

export const DEFAULT_SAVE_FOLDER = 'Documents/Turning Points';
export const PREFERENCES_COOKIE = 'turning-points';

export type Preferences = {
	source: GameSource;
	username: string;
	max: number;
	folder: string;
	sound: boolean;
};

export function parsePreferences(raw: string | undefined): Preferences {
	let value: Record<string, unknown> = {};
	try {
		value = JSON.parse(raw ?? '{}') ?? {};
	} catch {
		// ignore malformed cookie
	}
	return {
		source: value.source === 'chesscom' ? 'chesscom' : 'lichess',
		username: typeof value.username === 'string' ? value.username.slice(0, 30) : '',
		max: GAME_COUNTS.some((count) => count === value.max) ? (value.max as number) : 20,
		folder: typeof value.folder === 'string' ? value.folder : DEFAULT_SAVE_FOLDER,
		sound: value.sound !== false
	};
}

export function updatePreferences(patch: Partial<Preferences>): void {
	const match = document.cookie.match(new RegExp(`(?:^|; )${PREFERENCES_COOKIE}=([^;]*)`));
	const current = parsePreferences(match ? decodeURIComponent(match[1]) : undefined);
	const value = encodeURIComponent(JSON.stringify({ ...current, ...patch }));
	document.cookie = `${PREFERENCES_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}
