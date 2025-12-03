import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';

let cachedSpec: string | null = null;

/**
 * Serves the OpenAPI specification in YAML format
 * This is the canonical source format
 */
export const GET: RequestHandler = async () => {
	try {
		// Cache the spec to avoid re-reading on every request
		if (!cachedSpec) {
			const specPath = join(process.cwd(), 'openapi', 'openapi.yaml');
			cachedSpec = readFileSync(specPath, 'utf-8');
		}

		return new Response(cachedSpec, {
			headers: {
				'Content-Type': 'text/yaml',
				'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
				'Access-Control-Allow-Origin': '*' // Allow CORS for tools
			}
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				error: 'Failed to load OpenAPI specification',
				message: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};
