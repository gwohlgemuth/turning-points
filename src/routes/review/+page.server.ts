import { error } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { parsePreferences, PREFERENCES_COOKIE } from '#lib/preferences.ts';
import { localDay, parseReviewState, reviewDeck } from '#lib/review.ts';
import { FileError, isLocalAddress, readPgnFiles, readReview } from '#lib/server/files.ts';
import { collectStats } from '#lib/stats.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const { folder } = parsePreferences(cookies.get(PREFERENCES_COOKIE));
	try {
		const [files, review] = await Promise.all([
			readPgnFiles(homedir(), folder),
			readReview(homedir(), folder)
		]);
		const { entries } = collectStats(files);
		return { folder, ...reviewDeck(entries, parseReviewState(review), localDay()) };
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};
