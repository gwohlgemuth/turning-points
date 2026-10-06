import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { sameGame } from '#lib/games.ts';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export class FileError extends Error {
	constructor(
		message: string,
		readonly status = 400
	) {
		super(message);
	}
}

export function isLocalAddress(address: string): boolean {
	return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}

function resolveInside(root: string, path: string): string {
	const absolute = resolve(root, path);
	const rel = relative(root, absolute);
	if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
		throw new FileError('The folder must be inside your home folder');
	}
	return absolute;
}

async function checkRealPath(root: string, absolute: string): Promise<void> {
	const [real, realRoot] = await Promise.all([realpath(absolute), realpath(root)]);
	if (real !== realRoot && !real.startsWith(realRoot + sep)) {
		throw new FileError('The folder must be inside your home folder');
	}
}

function toRelative(root: string, absolute: string): string {
	return relative(root, absolute).split(sep).join('/');
}

function validateName(name: string, what: string): string {
	const trimmed = name.trim();
	if (!trimmed || trimmed.length > 100 || trimmed.startsWith('.') || /[/\\\0]/.test(trimmed)) {
		throw new FileError(`Invalid ${what}`);
	}
	return trimmed;
}

export async function listFolders(root: string, path: string) {
	const absolute = resolveInside(root, path);
	let entries;
	try {
		await checkRealPath(root, absolute);
		entries = await readdir(absolute, { withFileTypes: true });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return { path: toRelative(root, absolute), folders: [], exists: false };
		}
		throw err;
	}
	const folders = entries
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
	return { path: toRelative(root, absolute), folders, exists: true };
}

export async function createFolder(root: string, parent: string, name: string): Promise<string> {
	const absolute = resolveInside(root, join(parent, validateName(name, 'folder name')));
	await mkdir(absolute, { recursive: true });
	await checkRealPath(root, absolute);
	return toRelative(root, absolute);
}

async function holdsSameGame(path: string, text: string): Promise<boolean> {
	if (!(await lstat(path)).isFile()) return false;
	return sameGame(await readFile(path, 'utf8'), text);
}

export async function saveFile(
	root: string,
	folder: string,
	filename: string,
	text: string,
	replaceSameGame = false
): Promise<string> {
	const name = validateName(filename, 'file name');
	if (basename(name) !== name || extname(name).toLowerCase() !== '.pgn') {
		throw new FileError('Invalid file name');
	}
	const directory = resolveInside(root, folder);
	await mkdir(directory, { recursive: true });
	await checkRealPath(root, directory);

	const stem = name.slice(0, -extname(name).length);
	for (let n = 1; n < 1000; n++) {
		const candidate = join(directory, n === 1 ? name : `${stem} (${n}).pgn`);
		try {
			await writeFile(candidate, text, { flag: 'wx' });
			return toRelative(root, candidate);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
			if (replaceSameGame && (await holdsSameGame(candidate, text))) {
				await writeFile(candidate, text);
				return toRelative(root, candidate);
			}
		}
	}
	throw new FileError('Too many files with this name');
}
