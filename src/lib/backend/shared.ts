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
