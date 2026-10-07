import type { Variation } from './analysis.ts';

export async function fetchLines(
	fen: string,
	depth: number,
	lines: number,
	signal: AbortSignal
): Promise<Variation[]> {
	const response = await fetch('/api/lines', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ fen, depth, lines }),
		signal
	});
	const body = await response.json();
	if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
	return body.variations;
}
