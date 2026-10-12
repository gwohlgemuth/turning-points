import { error } from '@sveltejs/kit';
import backend from '#backend';
import { BackendError } from '#lib/backend/shared.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { folder } = (await parent()).preferences;
	try {
		return { folder, ...(await backend.reviewDeck(folder)) };
	} catch (err) {
		error(err instanceof BackendError ? err.status : 500, (err as Error).message);
	}
};
