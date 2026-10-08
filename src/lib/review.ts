import type { Side } from './analysis.ts';
import type { StatsEntry } from './stats.ts';

export const INTERVALS = [1, 3, 7, 14, 30];
export const REVIEW_DEPTH = 16;

export type CardState = { box: number; due: string } | { learned: true };
export type ReviewState = Record<string, CardState>;
export type Card = StatsEntry & { key: string; side: Side; due: string };

export const cardKey = (fen: string, san: string) => `${fen}|${san}`;

export function addDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export function localDay(date = new Date()): string {
	const offset = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function nextState(state: CardState | undefined, found: boolean, today: string): CardState {
	if (!found) return { box: 0, due: addDays(today, 1) };
	const box = state && 'box' in state ? state.box : 0;
	if (box >= INTERVALS.length) return { learned: true };
	return { box: box + 1, due: addDays(today, INTERVALS[box]) };
}

export function reviewDeck(entries: StatsEntry[], state: ReviewState, today: string) {
	const due: Card[] = [];
	let upcoming = 0;
	let learned = 0;
	const seen = new Set<string>();
	for (const entry of entries) {
		if (entry.verdict !== 'missed' || !entry.fen) continue;
		const key = cardKey(entry.fen, entry.move);
		if (seen.has(key)) continue;
		seen.add(key);
		const card = state[key];
		if (card && 'learned' in card) learned++;
		else if (card && card.due > today) upcoming++;
		else due.push({ ...entry, key, side: entry.ply % 2 === 1 ? 'w' : 'b', due: card?.due ?? '' });
	}
	due.sort((a, b) => a.due.localeCompare(b.due));
	return { due, upcoming, learned };
}

export function parseReviewState(text: string): ReviewState {
	try {
		const value = JSON.parse(text);
		return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	} catch {
		return {};
	}
}
