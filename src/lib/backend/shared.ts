import { openingLeaks, profile, progress, repeatedPositions } from '../profile.ts';
import {
	localDay,
	nextState,
	parseReviewState,
	reviewDeck,
	scheduleNew,
	type CardState,
	type ReviewState
} from '../review.ts';
import { collectStats } from '../stats.ts';
import type { PgnFile } from './types.ts';

export class BackendError extends Error {
	constructor(
		message: string,
		readonly status = 500
	) {
		super(message);
	}
}

export function statsData(files: PgnFile[]) {
	const stats = collectStats(files);
	return {
		...stats,
		profile: profile(stats.entries),
		progress: progress(stats.entries),
		leaks: openingLeaks(stats.entries),
		repeated: repeatedPositions(stats.entries)
	};
}

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
