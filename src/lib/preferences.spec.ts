import { describe, it, expect } from 'vitest';
import { DEFAULT_SAVE_FOLDER, parsePreferences } from './preferences.ts';

describe('parsePreferences', () => {
	it('reads saved preferences', () => {
		const raw = JSON.stringify({
			source: 'chesscom',
			username: 'hikaru',
			max: 50,
			folder: 'Chess',
			sound: false,
			spotFirst: true,
			depth: 20,
			lines: 1,
			tab: 'saved'
		});
		expect(parsePreferences(raw)).toEqual({
			source: 'chesscom',
			username: 'hikaru',
			max: 50,
			folder: 'Chess',
			sound: false,
			spotFirst: true,
			depth: 20,
			lines: 1,
			tab: 'saved'
		});
	});

	it('falls back to defaults for missing, malformed or invalid values', () => {
		const defaults = {
			source: 'lichess',
			username: '',
			max: 20,
			folder: DEFAULT_SAVE_FOLDER,
			sound: true,
			spotFirst: false,
			depth: 16,
			lines: 3,
			tab: 'online'
		};
		expect(parsePreferences(undefined)).toEqual(defaults);
		expect(parsePreferences('not json')).toEqual(defaults);
		expect(parsePreferences('null')).toEqual(defaults);
		expect(parsePreferences(JSON.stringify({ source: 'x', max: 7, username: 5 }))).toEqual(
			defaults
		);
		expect(parsePreferences(JSON.stringify({ depth: 40, lines: 2.5, tab: 'other' }))).toEqual(
			defaults
		);
	});
});
