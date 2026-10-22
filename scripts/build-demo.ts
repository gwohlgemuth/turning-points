import { writeFileSync } from 'node:fs';
import { findTurningPoints, parseGame, TURNING_POINTS, type PositionEval } from '#lib/analysis.ts';
import { analyzeGame, engineLines } from '#lib/engine.ts';
import { gameKey, markNoTurningPoints, pgnFilename } from '#lib/games.ts';
import { emptyNotes, writeNotes, type Notes } from '#lib/notes.ts';
import type { CurrentGame, RecentEntry } from '#lib/recent.ts';
import { createStockfish } from '#lib/server/stockfish.ts';
import { DEMO_GAMES, type DemoGame } from '#lib/demo/games.ts';

const STOCKFISH = process.env.STOCKFISH_PATH ?? 'stockfish';
const THREADS = 1;
const DEPTH = 16;

async function withEngine<T>(run: (engine: ReturnType<typeof createStockfish>) => Promise<T>) {
	const engine = createStockfish(STOCKFISH);
	try {
		return await run(engine);
	} finally {
		engine.quit();
	}
}

async function evaluate(pgn: string): Promise<RecentEntry> {
	const game = parseGame(pgn);
	const evals: PositionEval[] = [];
	await withEngine((engine) =>
		analyzeGame(
			engine,
			THREADS,
			game,
			DEPTH,
			(event) => {
				if (event.type === 'eval') evals[event.eval.index] = event.eval;
				if (event.type === 'error') throw new Error(event.message);
			},
			() => false
		)
	);
	return { key: gameKey(pgn)!, pgn, depth: DEPTH, ...game, evals, analyzedAt: Date.now() };
}

async function annotate(demo: DemoGame, entry: RecentEntry) {
	const turningPoints = findTurningPoints(
		entry.evals.map((e) => e.winPercent),
		TURNING_POINTS,
		demo.side
	);
	const notes: Record<number, Notes> = {};
	for (const tp of turningPoints) {
		const move = entry.moves[tp.ply - 1];
		const [line] = await withEngine((engine) =>
			engineLines(engine, THREADS, move.fenBefore, DEPTH, 1)
		);
		const best = line.moves.slice(0, 4).join(' ');
		console.log(
			`  ply ${tp.ply} ${move.san}  ${tp.before.toFixed(0)}% → ${tp.after.toFixed(0)}%  best: ${best}`
		);
		const note = demo.notes[tp.ply];
		notes[tp.ply] = { ...emptyNotes(), ...note, best: note?.candidate ? best : '' };
	}
	for (const ply of Object.keys(demo.notes).map(Number)) {
		if (!notes[ply]) console.warn(`  notes for ply ${ply} are not on a turning point`);
	}
	return markNoTurningPoints(writeNotes(entry.pgn, notes), !turningPoints.length);
}

const recent: RecentEntry[] = [];
const files: { path: string; text: string }[] = [];
for (const demo of DEMO_GAMES) {
	const entry = await evaluate(demo.pgn);
	console.log(`${entry.headers.White} – ${entry.headers.Black}`);
	const pgn = await annotate(demo, entry);
	recent.push({ ...entry, pgn });
	if (Object.keys(demo.notes).length) files.push({ path: pgnFilename(pgn), text: pgn });
}

const [first] = recent;
const current: CurrentGame = {
	key: first.key,
	pgn: first.pgn,
	side: DEMO_GAMES[0].side,
	selected: 0,
	notes: {},
	revealed: {},
	spotFlags: [],
	spotting: false
};

writeFileSync('src/lib/demo/demo.json', JSON.stringify({ recent, files, current }) + '\n');
console.log(`${recent.length} games, ${files.length} with notes`);
