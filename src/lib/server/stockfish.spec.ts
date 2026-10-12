import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createStockfish } from './stockfish.ts';

describe('Stockfish.quit', () => {
	it('does not crash when the engine has already closed its input', async () => {
		const script = join(mkdtempSync(join(tmpdir(), 'engine-')), 'engine.sh');
		writeFileSync(script, '#!/bin/sh\nexec 0<&-\nsleep 1\n');
		chmodSync(script, 0o755);
		const engine = createStockfish(script);
		await new Promise((resolve) => setTimeout(resolve, 200));
		engine.quit();
		engine.quit();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(true).toBe(true);
	});

	it('does not crash when the engine binary is missing', async () => {
		const engine = createStockfish('/nonexistent/stockfish');
		engine.quit();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(true).toBe(true);
	});
});
