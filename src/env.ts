import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	STOCKFISH_PATH: {
		description: 'Path to the Stockfish binary',
		schema: (value) => value || 'stockfish'
	},
	STOCKFISH_THREADS: {
		description: 'Number of engine threads per analysis',
		schema: (value) => {
			const threads = Number(value || 2);
			if (!Number.isInteger(threads) || threads < 1) {
				throw new Error('STOCKFISH_THREADS must be a positive integer');
			}
			return threads;
		}
	}
});
