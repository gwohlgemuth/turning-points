export type PieceMap = Record<string, string>;
export type Slide = { from: string; to: string };

const MAX_CHANGED_SQUARES = 4;

export function findSlides(previous: PieceMap, next: PieceMap): Slide[] {
	const squares = new Set([...Object.keys(previous), ...Object.keys(next)]);
	const changed = [...squares].filter((square) => previous[square] !== next[square]);
	if (changed.length > MAX_CHANGED_SQUARES) return [];

	const vanished = changed.filter((square) => previous[square]);
	const slides: Slide[] = [];
	for (const to of changed.filter((square) => next[square])) {
		const index = vanished.findIndex((from) => previous[from] === next[to]);
		if (index < 0) continue;
		slides.push({ from: vanished[index], to });
		vanished.splice(index, 1);
	}
	return slides;
}

export function squareOffset(from: string, to: string, flipped: boolean): [number, number] {
	const sign = flipped ? -1 : 1;
	const dx = from.charCodeAt(0) - to.charCodeAt(0);
	const dy = Number(to[1]) - Number(from[1]);
	return [dx * sign, dy * sign];
}
