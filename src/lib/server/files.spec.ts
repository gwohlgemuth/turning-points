import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import {
	createFolder,
	isLocalAddress,
	listFolders,
	readPgnFiles,
	readReview,
	saveFile,
	writeReview
} from './files.ts';

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'home-'));
});

describe('saveFile', () => {
	it('creates the folder and never overwrites an existing file', async () => {
		expect(await saveFile(root, 'Documents/Turning Points', 'a.pgn', 'one')).toBe(
			'Documents/Turning Points/a.pgn'
		);
		expect(await saveFile(root, 'Documents/Turning Points', 'a.pgn', 'two')).toBe(
			'Documents/Turning Points/a (2).pgn'
		);
		expect(readFileSync(join(root, 'Documents/Turning Points/a.pgn'), 'utf8')).toBe('one');
	});

	it('replaces a file only when it holds the same game', async () => {
		const game = '[Site "https://lichess.org/abc"]\n\n1. e4 e5 *';
		const other = '[Site "https://lichess.org/xyz"]\n\n1. e4 e5 *';
		expect(await saveFile(root, '', 'a.pgn', other)).toBe('a.pgn');
		expect(await saveFile(root, '', 'a.pgn', game, true)).toBe('a (2).pgn');
		expect(await saveFile(root, '', 'a.pgn', game + ' notes', true)).toBe('a (2).pgn');
		expect(readFileSync(join(root, 'a.pgn'), 'utf8')).toBe(other);
		expect(readFileSync(join(root, 'a (2).pgn'), 'utf8')).toBe(game + ' notes');
	});

	it('rejects folders outside the root and unsafe file names', async () => {
		await expect(saveFile(root, '../outside', 'a.pgn', 'x')).rejects.toThrow('home folder');
		await expect(saveFile(root, '/etc', 'a.pgn', 'x')).rejects.toThrow('home folder');
		await expect(saveFile(root, '', '../a.pgn', 'x')).rejects.toThrow('Invalid file name');
		await expect(saveFile(root, '', 'a.sh', 'x')).rejects.toThrow('Invalid file name');
		await expect(saveFile(root, '', '.hidden.pgn', 'x')).rejects.toThrow('Invalid file name');
	});

	it('rejects symlinks that point outside the root', async () => {
		const outside = mkdtempSync(join(tmpdir(), 'outside-'));
		symlinkSync(outside, join(root, 'link'));
		await expect(saveFile(root, 'link', 'a.pgn', 'x')).rejects.toThrow('home folder');
	});
});

describe('listFolders and createFolder', () => {
	it('lists visible subfolders sorted by name', async () => {
		mkdirSync(join(root, 'b'));
		mkdirSync(join(root, 'a'));
		mkdirSync(join(root, '.hidden'));
		expect(await listFolders(root, '')).toEqual({ path: '', folders: ['a', 'b'], exists: true });
	});

	it('reports a missing folder instead of failing', async () => {
		expect(await listFolders(root, 'Documents/Turning Points')).toEqual({
			path: 'Documents/Turning Points',
			folders: [],
			exists: false
		});
	});

	it('creates a folder and validates its name', async () => {
		expect(await createFolder(root, 'Documents', 'Openings')).toBe('Documents/Openings');
		expect((await listFolders(root, 'Documents')).folders).toEqual(['Openings']);
		await expect(createFolder(root, '', 'a/b')).rejects.toThrow('Invalid folder name');
		await expect(createFolder(root, '', '..')).rejects.toThrow('Invalid folder name');
	});
});

describe('readPgnFiles', () => {
	it('reads .pgn files in the folder and its subfolders', async () => {
		mkdirSync(join(root, 'games/png'), { recursive: true });
		writeFileSync(join(root, 'games/a.pgn'), 'one');
		writeFileSync(join(root, 'games/png/b.PGN'), 'two');
		writeFileSync(join(root, 'games/notes.txt'), 'skip');
		const files = await readPgnFiles(root, 'games');
		expect(files.sort((a, b) => a.path.localeCompare(b.path))).toEqual([
			{ path: 'a.pgn', text: 'one' },
			{ path: 'png/b.PGN', text: 'two' }
		]);
	});

	it('skips symlinks and returns nothing for a missing folder', async () => {
		const outside = mkdtempSync(join(tmpdir(), 'outside-'));
		writeFileSync(join(outside, 'secret.pgn'), 'x');
		mkdirSync(join(root, 'games'));
		symlinkSync(join(outside, 'secret.pgn'), join(root, 'games/link.pgn'));
		symlinkSync(outside, join(root, 'games/dir'));
		expect(await readPgnFiles(root, 'games')).toEqual([]);
		expect(await readPgnFiles(root, 'missing')).toEqual([]);
	});

	it('rejects folders outside the root', async () => {
		await expect(readPgnFiles(root, '../outside')).rejects.toThrow('home folder');
	});
});

describe('readReview and writeReview', () => {
	it('stores the review state in the save folder', async () => {
		expect(await readReview(root, 'games')).toBe('{}');
		await writeReview(root, 'games', '{"a":{"learned":true}}');
		expect(readFileSync(join(root, 'games/.review.json'), 'utf8')).toBe('{"a":{"learned":true}}');
		expect(await readReview(root, 'games')).toBe('{"a":{"learned":true}}');
	});

	it('rejects folders outside the root', async () => {
		await expect(writeReview(root, '../outside', '{}')).rejects.toThrow('home folder');
	});
});

describe('isLocalAddress', () => {
	it('accepts only loopback addresses', () => {
		expect(isLocalAddress('127.0.0.1')).toBe(true);
		expect(isLocalAddress('::1')).toBe(true);
		expect(isLocalAddress('192.168.178.50')).toBe(false);
	});
});
