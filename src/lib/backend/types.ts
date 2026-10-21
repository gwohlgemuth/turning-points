import type { AnalyzeEvent, Variation } from '../analysis.ts';
import type { EngineMove } from '../engine.ts';
import type { GameSource, GameSummary } from '../games.ts';
import type { CardState } from '../review.ts';
import type { SavedGame } from '../stats.ts';
import type { ReviewData, StatsData } from './shared.ts';

export type PgnFile = { path: string; text: string };

export type FolderListing = { path: string; folders: string[]; exists: boolean };

export type Backend = {
	describe(path: string): string;
	analyze(
		pgn: string,
		depth: number,
		signal: AbortSignal,
		onEvent: (event: AnalyzeEvent) => void
	): Promise<void>;
	lines(fen: string, depth: number, lines: number, signal: AbortSignal): Promise<Variation[]>;
	move(fen: string, elo: number, signal: AbortSignal): Promise<EngineMove>;
	games(source: GameSource, user: string, max: number): Promise<GameSummary[]>;
	saved(folder: string): Promise<SavedGame[]>;
	save(
		folder: string,
		text: string,
		filename: string,
		replaceSameGame: boolean
	): Promise<{ path: string; scheduled: number }>;
	review(folder: string, key: string, found: boolean): Promise<CardState>;
	stats(folder: string): Promise<StatsData>;
	reviewDeck(folder: string, today?: string): Promise<ReviewData>;
	listFolders?(path: string): Promise<FolderListing>;
	createFolder?(parent: string, name: string): Promise<string>;
	exportSync?(): Promise<string>;
	importSync?(text: string): Promise<number>;
	deleteGame?(file: string): Promise<void>;
	deleteAll?(): Promise<void>;
};
