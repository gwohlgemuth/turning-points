export type MoveTime = { spent: number; remaining: number };
export type TimeControl = { base: number; increment: number };

export function parseClock(text: string): number | null {
	const match = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(text.trim());
	if (!match) return null;
	return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function extractClocks(pgn: string): number[] {
	const clocks: number[] = [];
	for (const match of pgn.matchAll(/\[%clk\s+([\d:.]+)\]/g)) {
		const seconds = parseClock(match[1]);
		if (seconds !== null) clocks.push(seconds);
	}
	return clocks;
}

export function parseTimeControl(value: string | undefined): TimeControl | null {
	const match = /^(\d+)(?:\+(\d+))?$/.exec(value?.trim() ?? '');
	if (!match) return null;
	return { base: Number(match[1]), increment: Number(match[2] ?? 0) };
}

export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical';

export function speedOf(control: TimeControl | null): Speed | null {
	if (!control) return null;
	const estimate = control.base + 40 * control.increment;
	if (estimate < 180) return 'bullet';
	if (estimate < 480) return 'blitz';
	if (estimate < 1500) return 'rapid';
	return 'classical';
}

export function moveTimes(clocks: number[], timeControl: TimeControl): MoveTime[] {
	return clocks.map((remaining, i) => {
		const previous = i >= 2 ? clocks[i - 2] : timeControl.base;
		const increment = i >= 2 ? timeControl.increment : 0;
		const spent = Math.max(0, Math.round((previous + increment - remaining) * 10) / 10);
		return { spent, remaining };
	});
}

export function formatDuration(seconds: number): string {
	if (seconds < 10) return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
	if (seconds < 60) return `${Math.round(seconds)} s`;
	return formatClock(seconds);
}

export function formatClock(seconds: number): string {
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function describeTime(time: MoveTime): string {
	return `${formatDuration(time.spent)} (${formatClock(time.remaining)} left)`;
}
