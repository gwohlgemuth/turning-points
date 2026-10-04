export const DEFAULT_SAVE_FOLDER = 'Documents/Turning Points';

const STORAGE_KEY = 'turning-points:save-folder';

export const saving = $state({ folder: DEFAULT_SAVE_FOLDER, message: '', failed: false });

export function loadSaveFolder(): void {
	try {
		saving.folder = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SAVE_FOLDER;
	} catch {
		// storage unavailable
	}
}

export function setSaveFolder(folder: string): void {
	saving.folder = folder;
	try {
		localStorage.setItem(STORAGE_KEY, folder);
	} catch {
		// storage unavailable
	}
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
