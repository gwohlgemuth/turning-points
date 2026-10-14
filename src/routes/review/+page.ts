import { error } from '@sveltejs/kit';
import backend from '#backend';
import { BackendError } from '#lib/backend/shared.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
	const { folder } = (await parent()).preferences;
	const today =
		import.meta.env.DEV && url.searchParams.get('due') === 'all' ? '9999-12-31' : undefined;
	try {
		return { folder, ...(await backend.reviewDeck(folder, today)) };
	} catch (err) {
		error(err instanceof BackendError ? err.status : 500, (err as Error).message);
	}
};
