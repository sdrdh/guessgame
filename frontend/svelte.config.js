import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// SPA mode configuration
			fallback: 'index.html', // Serve index.html for all routes
			precompress: false
		}),
		alias: {
			"@/*": "./src/lib/*",
		}
	}
};

export default config;
