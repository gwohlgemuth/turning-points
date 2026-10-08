export const sound = $state({ enabled: true });

let context: AudioContext | null = null;

function audio(): AudioContext | null {
	if (!sound.enabled || typeof AudioContext === 'undefined') return null;
	context ??= new AudioContext();
	if (context.state === 'suspended') void context.resume();
	return context;
}

function tone(
	ctx: AudioContext,
	frequency: number,
	start: number,
	duration: number,
	volume = 0.12
) {
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = 'triangle';
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(volume, ctx.currentTime + start);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
	oscillator.connect(gain).connect(ctx.destination);
	oscillator.start(ctx.currentTime + start);
	oscillator.stop(ctx.currentTime + start + duration);
}

function knock(ctx: AudioContext, volume: number, frequency: number) {
	const length = Math.floor(ctx.sampleRate * 0.06);
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4;
	const source = ctx.createBufferSource();
	const filter = ctx.createBiquadFilter();
	const gain = ctx.createGain();
	source.buffer = buffer;
	filter.type = 'bandpass';
	filter.frequency.value = frequency;
	gain.gain.value = volume;
	source.connect(filter).connect(gain).connect(ctx.destination);
	source.start();
}

export function playMove(capture: boolean) {
	const ctx = audio();
	if (!ctx) return;
	knock(ctx, capture ? 1.6 : 0.9, capture ? 900 : 1400);
}

export function playFound() {
	const ctx = audio();
	if (!ctx) return;
	tone(ctx, 784, 0, 0.18);
	tone(ctx, 1047, 0.1, 0.35);
}

export function playMissed() {
	const ctx = audio();
	if (!ctx) return;
	tone(ctx, 330, 0, 0.2, 0.08);
	tone(ctx, 247, 0.12, 0.35, 0.08);
}
