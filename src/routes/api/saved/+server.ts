import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { parsePreferences, PREFERENCES_COOKIE } from '#lib/preferences.ts';
import { FileError, isLocalAddress, readPgnFiles } from '#lib/server/files.ts';
import { savedGames } from '#lib/stats.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const { folder } = parsePreferences(cookies.get(PREFERENCES_COOKIE));
	try {
		return json({ games: savedGames(await readPgnFiles(homedir(), folder)) });
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};
