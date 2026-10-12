import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { formatReview, scheduleMissed } from '#lib/backend/shared.ts';
import { parseReviewState } from '#lib/review.ts';
import { FileError, isLocalAddress, readReview, saveFile, writeReview } from '#lib/server/files.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	if (typeof body.text !== 'string' || !body.text.trim()) error(400, 'Nothing to save');
	const folder = String(body.folder ?? '');
	try {
		const path = await saveFile(
			homedir(),
			folder,
			String(body.filename ?? ''),
			body.text,
			body.replaceSameGame === true
		);
		const state = parseReviewState(await readReview(homedir(), folder));
		const scheduled = scheduleMissed(state, { path, text: body.text });
		if (scheduled) await writeReview(homedir(), folder, formatReview(state));
		return json({ path, scheduled });
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};
