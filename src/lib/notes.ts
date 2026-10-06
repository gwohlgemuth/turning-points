import { Chess } from 'chess.js';
import { mergeAdjacentComments } from './games.ts';

export type Notes = [string, string, string];

export const NOTE_QUESTIONS = [
	{ question: 'Why did I choose that move?', label: 'Why I chose it:' },
	{ question: 'Why is my move not ideal?', label: 'Why it is not ideal:' },
	{
		question: 'Why is the better move better than my chosen move?',
		label: 'Why the better move is better:'
	}
] as const;

const MARKER = 'Turning point.';
const NOTE_PATTERN = new RegExp(
	`${escape(MARKER)}${NOTE_QUESTIONS.map(({ label }) => `(?: ${escape(label)} (.*?))?`).join('')}$`
);

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clean(text: string): string {
	return text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

export const answeredCount = (notes: Notes | undefined) =>
	notes?.filter((answer) => clean(answer)).length ?? 0;

export function formatNote(notes: Notes): string {
	if (!answeredCount(notes)) return '';
	const parts = NOTE_QUESTIONS.flatMap(({ label }, i) =>
		clean(notes[i]) ? [`${label} ${clean(notes[i])}`] : []
	);
	return [MARKER, ...parts].join(' ');
}

function splitComment(comment: string): { rest: string; notes: Notes | null } {
	const index = comment.indexOf(MARKER);
	if (index < 0) return { rest: comment.trim(), notes: null };
	const match = NOTE_PATTERN.exec(comment.slice(index).trim());
	const notes: Notes = [match?.[1] ?? '', match?.[2] ?? '', match?.[3] ?? ''];
	return { rest: comment.slice(0, index).trim(), notes };
}

function load(pgn: string): Chess | null {
	const chess = new Chess();
	try {
		chess.loadPgn(mergeAdjacentComments(pgn));
		return chess;
	} catch {
		return null;
	}
}

export function readNotes(pgn: string): Record<number, Notes> {
	const chess = load(pgn);
	if (!chess) return {};
	const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]));
	const result: Record<number, Notes> = {};
	for (const [i, move] of chess.history({ verbose: true }).entries()) {
		const notes = splitComment(comments.get(move.after) ?? '').notes;
		if (notes) result[i + 1] = notes;
	}
	return result;
}

export function writeNotes(pgn: string, notes: Record<number, Notes>): string {
	const source = load(pgn);
	if (!source) return pgn;
	const history = source.history({ verbose: true });
	const comments = new Map(source.getComments().map((c) => [c.fen, c.comment]));
	const chess = new Chess(history[0]?.before);
	for (const [key, value] of Object.entries(source.getHeaders())) chess.setHeader(key, value);
	const startComment = comments.get(chess.fen());
	if (startComment) chess.setComment(startComment);
	for (const [i, move] of history.entries()) {
		chess.move(move.san);
		const { rest } = splitComment(comments.get(move.after) ?? '');
		const note = notes[i + 1] ? formatNote(notes[i + 1]) : '';
		const comment = [rest, note].filter(Boolean).join(' ');
		if (comment) chess.setComment(comment);
	}
	return chess.pgn() + '\n';
}
