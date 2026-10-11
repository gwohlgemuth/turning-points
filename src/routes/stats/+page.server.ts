import { error } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { parsePreferences, PREFERENCES_COOKIE } from '#lib/preferences.ts';
import { FileError, isLocalAddress, readPgnFiles } from '#lib/server/files.ts';
import { openingLeaks, profile, progress, repeatedPositions } from '#lib/profile.ts';
import { collectStats } from '#lib/stats.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const { folder } = parsePreferences(cookies.get(PREFERENCES_COOKIE));
	try {
		const stats = collectStats(await readPgnFiles(homedir(), folder));
		return {
			folder,
			...stats,
			profile: profile(stats.entries),
			progress: progress(stats.entries),
			leaks: openingLeaks(stats.entries),
			repeated: repeatedPositions(stats.entries)
		};
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};
