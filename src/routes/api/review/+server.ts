import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { parsePreferences, PREFERENCES_COOKIE } from '#lib/preferences.ts';
import { localDay, nextState, parseReviewState } from '#lib/review.ts';
import { FileError, isLocalAddress, readReview, writeReview } from '#lib/server/files.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	if (typeof body.key !== 'string' || !body.key) error(400, 'Missing card');
	const { folder } = parsePreferences(cookies.get(PREFERENCES_COOKIE));
	try {
		const state = parseReviewState(await readReview(homedir(), folder));
		state[body.key] = nextState(state[body.key], body.found === true, localDay());
		await writeReview(homedir(), folder, JSON.stringify(state, null, '\t') + '\n');
		return json(state[body.key]);
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};
