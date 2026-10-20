import type { Move, PositionEval, Side } from './analysis.ts';
import type { Notes } from './notes.ts';

export const MAX_RECENT = 20;
const STORAGE_KEY = 'turning-points-recent';
const CURRENT_KEY = 'turning-points-current';

export type RecentEntry = {
	key: string;
	pgn: string;
	depth: number;
	startFen: string;
	moves: Move[];
	headers: Record<string, string>;
	evals: PositionEval[];
	analyzedAt: number;
};

export function remember(list: RecentEntry[], entry: RecentEntry, max = MAX_RECENT) {
	return [entry, ...list.filter((other) => other.key !== entry.key)].slice(0, max);
}

export const forget = (list: RecentEntry[], key: string) =>
	list.filter((entry) => entry.key !== key);

export const findAnalysis = (list: RecentEntry[], key: string | null, depth: number) =>
	list.find((entry) => entry.key === key && entry.depth === depth) ?? null;

export const updatePgn = (list: RecentEntry[], key: string | null, pgn: string) =>
	list.map((entry) => (entry.key === key ? { ...entry, pgn } : entry));

export function loadRecent(): RecentEntry[] {
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}

export function saveRecent(list: RecentEntry[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch {
		// storage full or blocked: the list just isn't kept
	}
}

export type CurrentGame = {
	key: string;
	pgn: string;
	side: Side;
	selected: number;
	notes: Record<number, Notes>;
	revealed: Record<number, boolean>;
	spotFlags: number[];
	spotting: boolean;
};

export function loadCurrent(): CurrentGame | null {
	try {
		const value = JSON.parse(localStorage.getItem(CURRENT_KEY) ?? 'null');
		return value && typeof value.key === 'string' && typeof value.pgn === 'string' ? value : null;
	} catch {
		return null;
	}
}

export function saveCurrent(current: CurrentGame): void {
	try {
		localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
	} catch {
		// storage full or blocked: the game just isn't reopened
	}
}
