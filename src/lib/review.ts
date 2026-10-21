import type { Side } from './analysis.ts';
import { gameId } from './profile.ts';
import type { StatsEntry } from './stats.ts';

export const INTERVALS = [1, 3, 7, 14, 30];
export const REVIEW_DEPTH = 16;

export type CardState = { box: number; due: string } | { learned: true };
export type ReviewState = Record<string, CardState>;
export type Card = StatsEntry & { key: string; side: Side; due: string };

export const cardKey = (fen: string, san: string) => `${fen}|${san}`;

const UNSURE_BOX = INTERVALS.length - 1;

const unsureFind = (entry: StatsEntry) =>
	entry.verdict === 'found' && (entry.confidence === 'unsure' || entry.confidence === 'guess');

const reviewable = (entry: StatsEntry) =>
	!!entry.fen && (entry.verdict === 'missed' || unsureFind(entry));

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
	const upcoming: string[] = [];
	let learned = 0;
	const seen = new Set<string>();
	for (const entry of entries) {
		if (!reviewable(entry)) continue;
		const key = cardKey(entry.fen, entry.move);
		if (seen.has(key)) continue;
		seen.add(key);
		const card = state[key];
		if (!card && unsureFind(entry)) continue;
		if (card && 'learned' in card) learned++;
		else if (card && card.due > today) upcoming.push(card.due);
		else due.push({ ...entry, key, side: entry.ply % 2 === 1 ? 'w' : 'b', due: card?.due ?? '' });
	}
	due.sort((a, b) => a.due.localeCompare(b.due));
	return { due: mixGames(due), upcoming, learned };
}

function mixGames(cards: Card[]): Card[] {
	const byGame = new Map<string, Card[]>();
	for (const card of cards) byGame.set(gameId(card), [...(byGame.get(gameId(card)) ?? []), card]);
	const games = [...byGame.values()];
	const rounds = Math.max(0, ...games.map((game) => game.length));
	return Array.from({ length: rounds }, (_, round) =>
		games.flatMap((game) => game[round] ?? [])
	).flat();
}

export function scheduleNew(entries: StatsEntry[], state: ReviewState, today: string): number {
	let scheduled = 0;
	for (const entry of entries) {
		if (!reviewable(entry)) continue;
		const key = cardKey(entry.fen, entry.move);
		if (state[key]) continue;
		state[key] = { box: unsureFind(entry) ? UNSURE_BOX : 0, due: addDays(today, 1) };
		scheduled++;
	}
	return scheduled;
}

function furthest(a: CardState | undefined, b: CardState | undefined): CardState {
	if (!a || !b) return (a ?? b)!;
	if ('learned' in a) return a;
	if ('learned' in b) return b;
	if (a.box !== b.box) return a.box > b.box ? a : b;
	return a.due >= b.due ? a : b;
}

export function mergeReviewState(a: ReviewState, b: ReviewState): ReviewState {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	return Object.fromEntries([...keys].map((key) => [key, furthest(a[key], b[key])]));
}

export function parseReviewState(text: string): ReviewState {
	try {
		const value = JSON.parse(text);
		return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	} catch {
		return {};
	}
}
