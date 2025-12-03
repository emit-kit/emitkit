import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	define: {
		// Expose Vercel deployment ID for cache busting
		// Uses commit SHA in production, timestamp in development
		__DEPLOYMENT_ID__: JSON.stringify(
			process.env.VERCEL_GIT_COMMIT_SHA ||
			process.env.VERCEL_DEPLOYMENT_ID ||
			`dev-${Date.now()}`
		)
	},
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
