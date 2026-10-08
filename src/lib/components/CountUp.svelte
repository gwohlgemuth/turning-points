<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { formatScore, type Score } from '#lib/analysis.ts';
	import { ms } from '#lib/motion.ts';

	let { score, value = 0 }: { score?: Score; value?: number } = $props();

	const tween = new Tween(0, { duration: () => ms(700), easing: cubicOut });
	let current = $derived(Math.round(tween.current));
	let text = $derived.by(() => {
		if (!score) return String(current);
		if (score.type === 'mate') return formatScore(score);
		return formatScore({ type: 'cp', value: current });
	});

	$effect(() => {
		tween.target = score ? (score.type === 'cp' ? score.value : 0) : value;
	});
</script>

{text}
