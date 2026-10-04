import { error, json } from '@sveltejs/kit';
import { homedir } from 'node:os';
import { DEFAULT_SAVE_FOLDER } from '#lib/saving.svelte.ts';
import { createFolder, FileError, isLocalAddress, listFolders } from '#lib/server/files.ts';
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
	const path = url.searchParams.get('path') ?? DEFAULT_SAVE_FOLDER;
	return json(await handle(() => listFolders(homedir(), path)));
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!isLocalAddress(getClientAddress())) error(403, 'Only available on this computer');
	const body = await request.json().catch(() => error(400, 'Expected a JSON body'));
	const path = await handle(() =>
		createFolder(homedir(), String(body.parent ?? ''), String(body.name ?? ''))
	);
	return json({ path });
};
