import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { FileError, isLocalAddress, saveFile } from '#lib/server/files.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	if (typeof body.text !== 'string' || !body.text.trim()) error(400, 'Nothing to save');
	try {
		const path = await saveFile(
			homedir(),
			String(body.folder ?? ''),
			String(body.filename ?? ''),
			body.text
		);
		return json({ path });
	} catch (err) {
		if (err instanceof FileError) error(err.status, err.message);
		throw err;
	}
};
