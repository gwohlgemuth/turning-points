import { Chess, type Move } from 'chess.js';
import {
	gameUrl,
	mergeAdjacentComments,
	splitPgn,
	summaryFromPgn,
	type GameSummary
} from './games.ts';
import { answeredCount, readNotes, type Verdict } from './notes.ts';

export type StatsEntry = {
	file: string;
	date: number;
	white: string;
	black: string;
	ply: number;
	move: string;
	fen: string;
	candidate: string;
	verdict: Verdict;
	answered: number;
};

export type StatsSummary = {
	games: number;
	turningPoints: number;
	found: number;
	missed: number;
	unchecked: number;
};

function history(pgn: string): Move[] {
	const chess = new Chess();
	try {
		chess.loadPgn(mergeAdjacentComments(pgn));
		return chess.history({ verbose: true });
	} catch {
		return [];
	}
}

export function entriesFromPgn(file: string, pgn: string): StatsEntry[] {
	const notes = readNotes(pgn);
	const plies = Object.keys(notes).map(Number);
	if (!plies.length) return [];
	const moves = history(pgn);
	const { white, black, date } = summaryFromPgn(pgn, 0);
	return plies.map((ply) => ({
		file,
		date,
		white,
		black,
		ply,
		move: moves[ply - 1]?.san ?? '',
		fen: moves[ply - 1]?.before ?? '',
		candidate: notes[ply].candidate,
		verdict: notes[ply].verdict,
		answered: answeredCount(notes[ply])
	}));
}

export function summarize(entries: StatsEntry[]): StatsSummary {
	const count = (verdict: Verdict) => entries.filter((entry) => entry.verdict === verdict).length;
	return {
		games: new Set(
			entries.map((entry) => `${entry.file}|${entry.white}|${entry.black}|${entry.date}`)
		).size,
		turningPoints: entries.length,
		found: count('found'),
		missed: count('missed'),
		unchecked: count('')
	};
}

export function collectStats(files: { path: string; text: string }[]) {
	const entries = files
		.flatMap(({ path, text }) => splitPgn(text).flatMap((pgn) => entriesFromPgn(path, pgn)))
		.sort((a, b) => b.date - a.date || a.file.localeCompare(b.file) || a.ply - b.ply);
	return { entries, summary: summarize(entries) };
}

export type SavedGame = GameSummary & {
	file: string;
	worked: number;
	found: number;
	missed: number;
};

export function savedGames(files: { path: string; text: string }[]): SavedGame[] {
	const games = files
		.flatMap(({ path, text }) =>
			splitPgn(text).map((pgn, index) => {
				const entries = entriesFromPgn(path, pgn);
				return {
					...summaryFromPgn(pgn, index),
					id: `saved:${path}:${index}`,
					url: gameUrl(pgn) ?? '',
					file: path,
					worked: entries.length,
					found: entries.filter((entry) => entry.verdict === 'found').length,
					missed: entries.filter((entry) => entry.verdict === 'missed').length
				};
			})
		)
		.sort((a, b) => b.date - a.date || a.file.localeCompare(b.file));
	const byUrl = new Map<string, SavedGame>();
	for (const game of games) {
		const other = game.url && byUrl.get(game.url);
		if (game.url && (!other || game.worked > other.worked)) byUrl.set(game.url, game);
	}
	return games.filter((game) => !game.url || byUrl.get(game.url) === game);
}
