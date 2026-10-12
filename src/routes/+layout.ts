import { readPreferences } from '#lib/preferences.ts';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = () => ({ preferences: readPreferences() });
