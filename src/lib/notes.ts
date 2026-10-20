import { Chess } from 'chess.js';
import { mergeAdjacentComments } from './games.ts';

export type Verdict = 'found' | 'missed' | '';

export type Confidence = 'sure' | 'unsure' | 'guess' | '';

export type Cause = (typeof CAUSES)[number]['value'] | '';

export type Notes = {
	answers: [string, string, string];
	candidate: string;
	verdict: Verdict;
	best: string;
	confidence: Confidence;
	considered: string;
	cause: Cause;
	lesson: string;
};

export const emptyNotes = (): Notes => ({
	answers: ['', '', ''],
	candidate: '',
	verdict: '',
	best: '',
	confidence: '',
	considered: '',
	cause: '',
	lesson: ''
});

export const CONFIDENCES = [
	{ value: 'sure', label: 'Sure' },
	{ value: 'unsure', label: 'Unsure' },
	{ value: 'guess', label: 'Guess' }
] as const;

export const CAUSES = [
	{ value: 'threat', label: 'Missed a threat', hint: 'I did not see what my opponent wanted' },
	{ value: 'chance', label: 'Missed a chance', hint: 'I did not see a tactic or idea of my own' },
	{ value: 'calculation', label: 'Miscalculated', hint: 'I saw the idea but calculated it wrong' },
	{
		value: 'evaluation',
		label: 'Misjudged',
		hint: 'I calculated it but judged the resulting position wrong'
	},
	{ value: 'plan', label: 'Wrong plan', hint: 'I followed an idea that did not fit the position' },
	{ value: 'rushed', label: 'Rushed', hint: 'I played without checking the move' },
	{ value: 'nerves', label: 'Nerves', hint: 'Fear, overconfidence or impatience' }
] as const;

export const NOTE_QUESTIONS = [
	{ question: 'Why did I choose that move?', label: 'Why I chose it:' },
	{ question: 'Why is my move not ideal?', label: 'Why it is not ideal:' },
	{
		question: 'Why is the better move better than my chosen move?',
		label: 'Why the better move is better:'
	}
] as const;

const MARKER = 'Turning point.';
const CANDIDATE = 'Candidate:';
const BEST = 'Best:';
const CONFIDENCE = 'Confidence:';
const CONSIDERED = 'Considered:';
const CAUSE = 'Cause:';
const LESSON = 'Next time:';
const NOTE_PATTERN = new RegExp(
	`${escape(MARKER)}(?: ${escape(CANDIDATE)} (\\S+)(?: \\((found|missed)\\))?)?(?: ${escape(BEST)} (.*?)\\.)?(?: ${escape(CONFIDENCE)} (sure|unsure|guess)\\.)?(?: ${escape(CONSIDERED)} (.*?)\\.)?(?: ${escape(CAUSE)} (${CAUSES.map(({ value }) => value).join('|')})\\.)?${NOTE_QUESTIONS.map(({ label }) => `(?: ${escape(label)} (.*?))?`).join('')}(?: ${escape(LESSON)} (.*?))?$`
);

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clean(text: string): string {
	return text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

const moveList = (text: string) => [
	...new Set(
		clean(text)
			.replace(/\d+\.+/g, ' ')
			.split(/[\s,;]+/)
			.filter(Boolean)
	)
];

const bareMove = (san: string) => san.replace(/[+#!?]/g, '');

export const wasConsidered = (considered: string, san: string) =>
	moveList(considered).some((move) => bareMove(move) === bareMove(san));

export const answeredCount = (notes: Notes | undefined) =>
	notes?.answers.filter((answer) => clean(answer)).length ?? 0;

export const isRevealed = (notes: Notes | undefined) =>
	!!notes &&
	(!!notes.candidate ||
		!!clean(notes.answers[1]) ||
		!!clean(notes.answers[2]) ||
		!!notes.cause ||
		!!clean(notes.lesson));

export function formatNote(notes: Notes): string {
	const candidate = clean(notes.candidate).split(' ')[0];
	const lesson = clean(notes.lesson);
	const considered = moveList(notes.considered).join(' ');
	if (!answeredCount(notes) && !candidate && !considered && !notes.cause && !lesson) return '';
	const verdict = candidate && notes.verdict ? ` (${notes.verdict})` : '';
	const best = candidate ? clean(notes.best) : '';
	return [
		MARKER,
		...(candidate ? [`${CANDIDATE} ${candidate}${verdict}`] : []),
		...(best ? [`${BEST} ${best}.`] : []),
		...(candidate && notes.confidence ? [`${CONFIDENCE} ${notes.confidence}.`] : []),
		...(considered ? [`${CONSIDERED} ${considered}.`] : []),
		...(notes.cause ? [`${CAUSE} ${notes.cause}.`] : []),
		...NOTE_QUESTIONS.flatMap(({ label }, i) =>
			clean(notes.answers[i]) ? [`${label} ${clean(notes.answers[i])}`] : []
		),
		...(lesson ? [`${LESSON} ${lesson}`] : [])
	].join(' ');
}

function splitComment(comment: string): { rest: string; notes: Notes | null } {
	const index = comment.indexOf(MARKER);
	if (index < 0) return { rest: comment.trim(), notes: null };
	const match = NOTE_PATTERN.exec(comment.slice(index).trim());
	const notes: Notes = {
		answers: [match?.[7] ?? '', match?.[8] ?? '', match?.[9] ?? ''],
		candidate: match?.[1] ?? '',
		verdict: (match?.[2] ?? '') as Verdict,
		best: match?.[3] ?? '',
		confidence: (match?.[4] ?? '') as Confidence,
		considered: match?.[5] ?? '',
		cause: (match?.[6] ?? '') as Cause,
		lesson: match?.[10] ?? ''
	};
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

export const notesSignature = (notes: Record<number, Notes>) =>
	JSON.stringify(
		Object.entries(notes)
			.map(([ply, value]) => [ply, formatNote(value)])
			.filter(([, text]) => text)
	);

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
		const note = notes[i + 1] ? formatNote(notes[i + 1]) || MARKER : '';
		const comment = [rest, note].filter(Boolean).join(' ');
		if (comment) chess.setComment(comment);
	}
	return chess.pgn() + '\n';
}
