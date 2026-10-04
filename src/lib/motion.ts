import { prefersReducedMotion } from 'svelte/motion';

export function ms(duration: number): number {
	return prefersReducedMotion.current ? 0 : duration;
}
