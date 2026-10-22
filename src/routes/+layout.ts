import { demo } from '#lib/demo/mode.ts';
import { readPreferences } from '#lib/preferences.ts';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = import.meta.env.STATIC;

let seeded: Promise<void> | null = null;

export const load: LayoutLoad = async () => {
	if (demo.active) await (seeded ??= import('#lib/demo/seed.ts').then((m) => m.seedDemo()));
	return { preferences: readPreferences() };
};
