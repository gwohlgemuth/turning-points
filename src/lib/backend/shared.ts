import {
	openingLeaks,
	profile,
	progress,
	repeatedPositions,
	rulebook,
	timeAtTurningPoints
} from '../profile.ts';
import {
	localDay,
	nextState,
	parseReviewState,
	reviewDeck,
	scheduleNew,
	type CardState,
	type ReviewState
} from '../review.ts';
import { candidateNames, sameGame } from '../games.ts';
import { collectStats, summarize, type StatsEntry } from '../stats.ts';
import type { PgnFile } from './types.ts';

export class BackendError extends Error {
	constructor(
		message: string,
		readonly status = 500
	) {
		super(message);
	}
}

export const statsData = (files: PgnFile[]) => ({ entries: collectStats(files).entries });

export const statsView = (entries: StatsEntry[]) => ({
	summary: summarize(entries),
	profile: profile(entries),
	progress: progress(entries),
	leaks: openingLeaks(entries),
	repeated: repeatedPositions(entries),
	rules: rulebook(entries),
	thinking: timeAtTurningPoints(entries)
});

export type StatsData = ReturnType<typeof statsData>;

export function reviewData(files: PgnFile[], reviewText: string, today = localDay()) {
	const { entries } = collectStats(files);
	return reviewDeck(entries, parseReviewState(reviewText), today);
}

export type ReviewData = ReturnType<typeof reviewData>;

export function scheduleMissed(state: ReviewState, file: PgnFile): number {
	const { entries } = collectStats([file]);
	return scheduleNew(entries, state, localDay());
}

export function recordReview(state: ReviewState, key: string, found: boolean): CardState {
	state[key] = nextState(state[key], found, localDay());
	return state[key];
}

export const formatReview = (state: ReviewState) => JSON.stringify(state, null, '\t') + '\n';

export type SyncData = { files: PgnFile[]; review: ReviewState };

export const formatSync = (data: SyncData) =>
	JSON.stringify({ app: 'turning-points', version: 1, ...data }) + '\n';

export function parseSync(text: string): SyncData | null {
	try {
		const value = JSON.parse(text);
		if (value?.app !== 'turning-points' || !Array.isArray(value.files)) return null;
		return { files: value.files, review: parseReviewState(JSON.stringify(value.review ?? {})) };
	} catch {
		return null;
	}
}

const richer = (a: string, b: string) => a.length > b.length || (a.length === b.length && a > b);

export function filesToWrite(existing: PgnFile[], incoming: PgnFile[]): PgnFile[] {
	const files = [...existing];
	const changed: PgnFile[] = [];
	for (const { path, text } of incoming) {
		const index = files.findIndex((file) => file.text === text || sameGame(file.text, text));
		if (index >= 0) {
			if (!richer(text, files[index].text)) continue;
			files[index] = { path: files[index].path, text };
			changed.push(files[index]);
			continue;
		}
		const taken = new Set(files.map((file) => file.path));
		const free = candidateNames(path).find((name) => !taken.has(name));
		if (!free) throw new Error('Too many files with this name');
		files.push({ path: free, text });
		changed.push({ path: free, text });
	}
	return changed;
}
