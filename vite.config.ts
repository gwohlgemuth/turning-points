import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import nodeAdapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

const isStatic = process.env.BUILD_TARGET === 'static';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: isStatic ? staticAdapter({ strict: false }) : nodeAdapter(),
			serviceWorker: isStatic ? { register: true } : { register: false },
			version: isStatic ? { name: execSync('git rev-parse --short HEAD').toString().trim() } : {}
		})
	],
	define: { 'import.meta.env.STATIC': JSON.stringify(isStatic) },
	resolve: isStatic
		? { alias: { '#backend': new URL('./src/lib/backend/browser.ts', import.meta.url).pathname } }
		: {},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
