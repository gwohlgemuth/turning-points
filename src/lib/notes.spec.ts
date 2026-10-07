import { describe, it, expect } from 'vitest';
import {
	answeredCount,
	emptyNotes,
	formatNote,
	isRevealed,
	readNotes,
	writeNotes,
	type Notes
} from './notes.ts';

const pgn = `[White "A"]
[Black "B"]
[Result "*"]

1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Qh5 { [%clk 0:02:58] } *`;

const notes: Notes = {
	answers: ['It attacks f7', 'It ignores {development}', 'Nf3 develops\na piece'],
	candidate: ''
};

const answers = (a: string, b: string, c: string): Notes => ({ answers: [a, b, c], candidate: '' });

describe('formatNote', () => {
	it('labels each answer and removes braces and line breaks', () => {
		expect(formatNote(notes)).toBe(
			'Turning point. Why I chose it: It attacks f7 Why it is not ideal: It ignores development Why the better move is better: Nf3 develops a piece'
		);
	});

	it('leaves out empty answers', () => {
		expect(formatNote(answers('', ' ', 'Because'))).toBe(
			'Turning point. Why the better move is better: Because'
		);
		expect(formatNote(emptyNotes())).toBe('');
	});

	it('puts the candidate move first', () => {
		expect(formatNote({ answers: ['Fast', '', ''], candidate: 'Nf3' })).toBe(
			'Turning point. Candidate: Nf3 Why I chose it: Fast'
		);
		expect(formatNote({ ...emptyNotes(), candidate: 'O-O' })).toBe('Turning point. Candidate: O-O');
	});
});

describe('answeredCount', () => {
	it('counts non-empty answers', () => {
		expect(answeredCount(answers('a', ' ', 'b'))).toBe(2);
		expect(answeredCount(undefined)).toBe(0);
	});
});

describe('isRevealed', () => {
	it('is true once there is a candidate or an answer that needs the engine', () => {
		expect(isRevealed(undefined)).toBe(false);
		expect(isRevealed(answers('Only the first', '', ''))).toBe(false);
		expect(isRevealed({ ...emptyNotes(), candidate: 'Nf3' })).toBe(true);
		expect(isRevealed(answers('', 'Hangs a pawn', ''))).toBe(true);
		expect(isRevealed(answers('', '', 'Develops'))).toBe(true);
	});
});

describe('writeNotes and readNotes', () => {
	it('round-trips the answers and keeps clock comments and headers', () => {
		const written = writeNotes(pgn, { 3: notes });
		expect(written).toContain('[White "A"]');
		expect(written).toContain('{[%clk 0:02:58] Turning point. Why I chose it: It attacks f7');
		expect(written).toContain('{[%clk 0:03:00]}');
		expect(readNotes(written)).toEqual({
			3: answers('It attacks f7', 'It ignores development', 'Nf3 develops a piece')
		});
	});

	it('round-trips the candidate move', () => {
		const withAnswers = writeNotes(pgn, {
			3: { answers: ['Fast', '', 'Better'], candidate: 'Nc3' }
		});
		expect(readNotes(withAnswers)).toEqual({
			3: { answers: ['Fast', '', 'Better'], candidate: 'Nc3' }
		});
		const alone = writeNotes(pgn, { 3: { ...emptyNotes(), candidate: 'Qxf7+' } });
		expect(readNotes(alone)).toEqual({ 3: { ...emptyNotes(), candidate: 'Qxf7+' } });
	});

	it('replaces earlier notes instead of adding them again', () => {
		const once = writeNotes(pgn, { 3: notes });
		const twice = writeNotes(once, { 3: answers('Changed', '', '') });
		expect(twice.match(/Turning point\./g)).toHaveLength(1);
		expect(readNotes(twice)).toEqual({ 3: answers('Changed', '', '') });
	});

	it('removes notes that were cleared', () => {
		const written = writeNotes(writeNotes(pgn, { 1: notes }), { 1: emptyNotes() });
		expect(written).not.toContain('Turning point');
		expect(readNotes(written)).toEqual({});
	});

	it('reads nothing from a game without notes or an invalid PGN', () => {
		expect(readNotes(pgn)).toEqual({});
		expect(readNotes('not a game')).toEqual({});
	});
});
