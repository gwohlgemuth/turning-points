import { DEFAULT_POSITION } from 'chess.js';
import positions from './positions.txt?raw';
import { positionKey } from './key.ts';

const BOOK = new Set(positions.split('\n'));

export const inBook = (fen: string) => BOOK.has(positionKey(fen));

export function bookPlies(startFen: string, fens: string[]): number | null {
	if (positionKey(startFen) !== positionKey(DEFAULT_POSITION)) return null;
	return fens.findLastIndex(inBook) + 1;
}
