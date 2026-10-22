import backend from '#backend';
import { formatSync } from '../backend/shared.ts';
import { saveCurrent, saveRecent, type CurrentGame, type RecentEntry } from '../recent.ts';
import data from './demo.json';

export async function seedDemo(): Promise<void> {
	await backend.deleteAll?.();
	await backend.importSync?.(formatSync({ files: data.files, review: {} }));
	saveRecent(data.recent as RecentEntry[]);
	saveCurrent(data.current as CurrentGame);
}
