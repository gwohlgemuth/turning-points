<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { formatScore, type Score } from '#lib/analysis.ts';
	import { ms } from '#lib/motion.ts';

	let { score }: { score: Score } = $props();

	const value = new Tween(0, { duration: () => ms(700), easing: cubicOut });

	$effect(() => {
		value.target = score.type === 'cp' ? score.value : 0;
	});
</script>

{score.type === 'cp'
	? formatScore({ type: 'cp', value: Math.round(value.current) })
	: formatScore(score)}
