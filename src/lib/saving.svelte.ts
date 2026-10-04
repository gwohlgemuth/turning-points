import { DEFAULT_SAVE_FOLDER, updatePreferences } from './preferences.ts';

export const saving = $state({ folder: DEFAULT_SAVE_FOLDER, message: '', failed: false });

export function setSaveFolder(folder: string): void {
	saving.folder = folder;
	updatePreferences({ folder });
}

export async function savePgn(text: string, filename: string): Promise<void> {
	saving.message = 'Saving…';
	saving.failed = false;
	try {
		const response = await fetch('/api/save', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ folder: saving.folder, filename, text })
		});
		const body = await response.json();
		if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
		saving.message = `Saved to ~/${body.path}`;
	} catch (err) {
		saving.message = (err as Error).message;
		saving.failed = true;
	}
}
