import backend from '#backend';
import { DEFAULT_SAVE_FOLDER, updatePreferences } from './preferences.ts';

export const saving = $state({ folder: DEFAULT_SAVE_FOLDER, message: '', failed: false });

export function setSaveFolder(folder: string): void {
	saving.folder = folder;
	updatePreferences({ folder });
}

export async function savePgn(
	text: string,
	filename: string,
	replaceSameGame = false
): Promise<void> {
	saving.message = 'Saving…';
	saving.failed = false;
	try {
		const { path, scheduled } = await backend.save(saving.folder, text, filename, replaceSameGame);
		saving.message = `Saved to ${backend.describe(path)}${comeBack(scheduled)}`;
	} catch (err) {
		saving.message = (err as Error).message;
		saving.failed = true;
	}
}

function comeBack(scheduled: number): string {
	if (!scheduled) return '';
	const positions = scheduled === 1 ? 'missed position comes' : 'missed positions come';
	return ` · ${scheduled} ${positions} back in Review tomorrow`;
}
