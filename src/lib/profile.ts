import { Chess, type Move } from 'chess.js';
import type { MoveTime, TimeControl } from './clock.ts';
import { CAUSES, type Cause } from './notes.ts';
import type { StatsEntry } from './stats.ts';

export type Phase = 'opening' | 'middlegame' | 'endgame';
export type TimeTag = 'trouble' | 'quick' | 'normal';
export type Group = { label: string; hint: string; total: number; found: number; missed: number };
type Labels<T extends string> = Record<T, { label: string; hint: string }>;

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const OPENING_PLIES = 30;

function pieces(fen: string): string {
	return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '');
}

function material(fen: string, color: 'w' | 'b', pawns = true): number {
	return [...pieces(fen)]
		.filter((piece) => (piece === piece.toUpperCase()) === (color === 'w'))
		.filter((piece) => pawns || piece.toLowerCase() !== 'p')
		.reduce((sum, piece) => sum + (VALUES[piece.toLowerCase()] ?? 0), 0);
}

export function gamePhase(fen: string): Phase {
	const board = pieces(fen);
	const minors = (letters: string) => [...board].filter((piece) => letters.includes(piece)).length;
	const fullmove = Number(fen.split(' ')[5]) || 1;
	if (fullmove <= 12 && minors('NB') >= 3 && minors('nb') >= 3) return 'opening';
	const endgame = material(fen, 'w', false) <= 13 && material(fen, 'b', false) <= 13;
	return endgame ? 'endgame' : 'middlegame';
}

export function timeTag(time: MoveTime | null, control: TimeControl | null): TimeTag | null {
	if (!time || !control) return null;
	if (time.remaining < control.base * 0.1) return 'trouble';
	if (time.spent <= Math.max(1, control.base * 0.02)) return 'quick';
	return 'normal';
}

export function lostMaterial(history: Move[], ply: number): boolean {
	const move = history[ply - 1];
	if (!move) return false;
	const later = history[Math.min(ply + 3, history.length - 1)];
	const balance = (fen: string) =>
		material(fen, move.color) - material(fen, move.color === 'w' ? 'b' : 'w');
	return balance(move.before) - balance(later.after) >= 2;
}

export function winsMaterial(fen: string, sans: string[]): boolean {
	if (!fen || !sans.length) return false;
	const color = fen.split(' ')[1] === 'b' ? 'b' : 'w';
	const balance = (position: string) =>
		material(position, color) - material(position, color === 'w' ? 'b' : 'w');
	const chess = new Chess(fen);
	for (const san of sans) {
		try {
			chess.move(san);
		} catch {
			break;
		}
	}
	return balance(chess.fen()) - balance(fen) >= 2;
}

function group<T extends string>(
	entries: StatsEntry[],
	key: (entry: StatsEntry) => T | null,
	labels: Labels<T>
): Group[] {
	return (Object.keys(labels) as T[])
		.map((value) => {
			const matching = entries.filter((entry) => key(entry) === value);
			return {
				...labels[value],
				total: matching.length,
				found: matching.filter((entry) => entry.verdict === 'found').length,
				missed: matching.filter((entry) => entry.verdict === 'missed').length
			};
		})
		.filter((row) => row.total > 0);
}

const kindOf = (entry: StatsEntry) =>
	entry.tactical ? 'tactical' : entry.missedWin ? 'missedWin' : 'positional';

export function profile(entries: StatsEntry[]) {
	return {
		phase: group(entries, (entry) => entry.phase, {
			opening: { label: 'Opening', hint: 'Up to move 12 with at least 3 minor pieces each' },
			middlegame: { label: 'Middlegame', hint: 'Neither opening nor endgame' },
			endgame: { label: 'Endgame', hint: 'Each side has at most 13 points of pieces besides pawns' }
		}),
		time: group(entries, (entry) => entry.time, {
			trouble: { label: 'Time trouble', hint: 'Less than 10% of the base time left' },
			quick: { label: 'Quick move', hint: 'At most 2% of the base time spent' },
			normal: { label: 'Normal', hint: 'Neither time trouble nor a quick move' }
		}),
		kind: group(entries, kindOf, {
			tactical: {
				label: 'Material lost',
				hint: 'Down 2 or more points of material four plies later'
			},
			missedWin: {
				label: 'Missed win',
				hint: 'The best move won 2 or more points of material'
			},
			positional: { label: 'Positional', hint: 'No material lost or missed' }
		}),
		confidence: group(entries, (entry) => entry.confidence || null, {
			sure: { label: 'Sure', hint: 'You were sure of your candidate move' },
			unsure: { label: 'Unsure', hint: 'You were unsure of your candidate move' },
			guess: { label: 'Guess', hint: 'Your candidate move was a guess' }
		}),
		cause: group(
			entries,
			(entry) => entry.cause || null,
			Object.fromEntries(
				CAUSES.map(({ value, label, hint }) => [value, { label, hint }])
			) as Labels<Exclude<Cause, ''>>
		)
	};
}

export function rulebook(entries: StatsEntry[]) {
	const withRule = entries.filter((entry) => entry.lesson.trim());
	const section = (label: string, cause: Cause) => ({
		label,
		rules: withRule.filter((entry) => entry.cause === cause)
	});
	return [
		...CAUSES.map(({ value, label }) => section(label, value)).sort(
			(a, b) => b.rules.length - a.rules.length
		),
		section('No cause given', '')
	].filter(({ rules }) => rules.length);
}

const gameId = (entry: StatsEntry) => `${entry.file}|${entry.date}|${entry.white}|${entry.black}`;

export function openingLeaks(entries: StatsEntry[]) {
	const byOpening = new Map<string, StatsEntry[]>();
	for (const entry of entries) {
		if (entry.ply > OPENING_PLIES) continue;
		const name = entry.opening || 'Unknown';
		byOpening.set(name, [...(byOpening.get(name) ?? []), entry]);
	}
	return [...byOpening.entries()]
		.map(([opening, list]) => ({
			opening,
			games: new Set(list.map(gameId)).size,
			turningPoints: list.length,
			missed: list.filter((entry) => entry.verdict === 'missed').length
		}))
		.sort((a, b) => b.turningPoints - a.turningPoints || a.opening.localeCompare(b.opening));
}

export function repeatedPositions(entries: StatsEntry[]) {
	const byPosition = new Map<string, StatsEntry[]>();
	for (const entry of entries) {
		if (!entry.fen) continue;
		const key = entry.fen.split(' ').slice(0, 4).join(' ');
		byPosition.set(key, [...(byPosition.get(key) ?? []), entry]);
	}
	return [...byPosition.values()]
		.map((list) => ({
			fen: list[0].fen,
			ply: list[0].ply,
			moves: [...new Set(list.map((entry) => entry.move))],
			games: new Set(list.map(gameId)).size,
			missed: list.filter((entry) => entry.verdict === 'missed').length
		}))
		.filter((row) => row.games >= 2)
		.sort((a, b) => b.games - a.games || a.ply - b.ply);
}

export type ProgressPoint = {
	label: string;
	games: number;
	checked: number;
	missed: number;
	spotChecked: number;
	spotted: number;
};

const DAY = 86_400_000;
const WEEKLY_SPAN = 12 * 7 * DAY;

function weekStart(date: number): string {
	const day = new Date(date);
	const offset = (day.getUTCDay() + 6) % 7;
	return new Date(date - offset * DAY).toISOString().slice(0, 10);
}

export function progress(entries: StatsEntry[]): ProgressPoint[] {
	const dated = entries.filter((entry) => entry.date > 0);
	if (!dated.length) return [];
	const dates = dated.map((entry) => entry.date);
	const weekly = Math.max(...dates) - Math.min(...dates) <= WEEKLY_SPAN;
	const bucket = (date: number) =>
		weekly ? weekStart(date) : new Date(date).toISOString().slice(0, 7);
	const byBucket = new Map<string, StatsEntry[]>();
	for (const entry of dated) {
		const key = bucket(entry.date);
		byBucket.set(key, [...(byBucket.get(key) ?? []), entry]);
	}
	return [...byBucket.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([label, list]) => ({
			label,
			games: new Set(list.map(gameId)).size,
			checked: list.filter((entry) => entry.verdict).length,
			missed: list.filter((entry) => entry.verdict === 'missed').length,
			spotChecked: list.filter((entry) => entry.spotted !== null).length,
			spotted: list.filter((entry) => entry.spotted).length
		}));
}
