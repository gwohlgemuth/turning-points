import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { formatReview, recordReview, reviewData } from '#lib/backend/shared.ts';
import { DEFAULT_SAVE_FOLDER } from '#lib/preferences.ts';
import { parseReviewState } from '#lib/review.ts';
import {
	FileError,
	isLocalAddress,
	readPgnFiles,
	readReview,
	writeReview
} from '#lib/server/files.ts';
import type { RequestHandler } from './$types';

async function handle<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
}

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const folder = url.searchParams.get('folder') ?? DEFAULT_SAVE_FOLDER;
	const [files, review] = await handle(() =>
		Promise.all([readPgnFiles(homedir(), folder), readReview(homedir(), folder)])
	);
	return json(reviewData(files, review, url.searchParams.get('today') ?? undefined));
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	if (typeof body.key !== 'string' || !body.key) error(400, 'Missing card');
	const folder = String(body.folder ?? DEFAULT_SAVE_FOLDER);
	return json(
		await handle(async () => {
			const state = parseReviewState(await readReview(homedir(), folder));
			const card = recordReview(state, body.key, body.found === true);
			await writeReview(homedir(), folder, formatReview(state));
			return card;
		})
	);
};
