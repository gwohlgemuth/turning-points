import { parsePreferences, PREFERENCES_COOKIE } from '#lib/preferences.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies }) => ({
	preferences: parsePreferences(cookies.get(PREFERENCES_COOKIE))
});
