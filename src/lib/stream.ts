import type { AnalyzeEvent } from './analysis.ts';

export async function streamAnalysis(
	pgn: string,
	depth: number,
	signal: AbortSignal,
	onEvent: (event: AnalyzeEvent) => void
): Promise<void> {
	const response = await fetch('/api/analyze', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ pgn, depth }),
		signal
	});
	if (!response.ok || !response.body) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.message ?? `Request failed (${response.status})`);
	}
	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += value;
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
	}
}
