import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { localDay, parseReviewState, scheduleNew } from '#lib/review.ts';
import { FileError, isLocalAddress, readReview, saveFile, writeReview } from '#lib/server/files.ts';
import { collectStats } from '#lib/stats.ts';
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
		return json({ path, scheduled: await scheduleMissed(folder, path, body.text) });
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};

async function scheduleMissed(folder: string, path: string, text: string): Promise<number> {
	const state = parseReviewState(await readReview(homedir(), folder));
	const { entries } = collectStats([{ path, text }]);
	const scheduled = scheduleNew(entries, state, localDay());
	if (scheduled) await writeReview(homedir(), folder, JSON.stringify(state, null, '\t') + '\n');
	return scheduled;
}
