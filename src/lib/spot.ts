import { pgnHeader, writeHeader } from './games.ts';

export const isSpotted = (ply: number, flags: number[]) =>
	flags.includes(ply) || flags.includes(ply - 2);

export const isFalseAlarm = (flag: number, turningPlies: number[]) =>
	!turningPlies.some((ply) => isSpotted(ply, [flag]));

export function spotScore(turningPlies: number[], flags: number[]) {
	const spotted = turningPlies.filter((ply) => isSpotted(ply, flags)).length;
	const falseAlarms = flags.filter((flag) => isFalseAlarm(flag, turningPlies)).length;
	return { spotted, total: turningPlies.length, falseAlarms };
}

export function readSpotFlags(pgn: string): number[] {
	const value = pgnHeader(pgn, 'SpotFlags') ?? '';
	return value
		.split(/\s+/)
		.map(Number)
		.filter((ply) => Number.isInteger(ply) && ply > 0);
}

export const writeSpotFlags = (pgn: string, flags: number[]) =>
	writeHeader(pgn, 'SpotFlags', flags.length ? [...flags].sort((a, b) => a - b).join(' ') : null);
