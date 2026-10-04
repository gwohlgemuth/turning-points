import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { createFolder, isLocalAddress, listFolders, saveFile } from './files.ts';

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

describe('isLocalAddress', () => {
	it('accepts only loopback addresses', () => {
		expect(isLocalAddress('127.0.0.1')).toBe(true);
		expect(isLocalAddress('::1')).toBe(true);
		expect(isLocalAddress('192.168.178.50')).toBe(false);
	});
});
