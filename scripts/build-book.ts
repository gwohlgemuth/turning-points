import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { positionKey } from '../src/lib/book/key.ts';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-book.ts <chess-openings checkout>');

const keys = new Set<string>();
for (const file of ['a', 'b', 'c', 'd', 'e']) {
	const lines = readFileSync(join(source, `${file}.tsv`), 'utf8')
		.trim()
		.split('\n')
		.slice(1);
	for (const line of lines) {
		const chess = new Chess();
		for (const san of line
			.split('\t')[2]
			.replace(/\d+\.+/g, ' ')
			.trim()
			.split(/\s+/)) {
			chess.move(san);
			keys.add(positionKey(chess.fen()));
		}
	}
}
writeFileSync('src/lib/book/positions.txt', [...keys].sort().join('\n') + '\n');
console.log(`${keys.size} book positions`);
