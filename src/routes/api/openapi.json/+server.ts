import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

let cachedSpec: object | null = null;

/**
 * Serves the OpenAPI specification in JSON format
 * This allows tools like Swagger UI, Postman, and SDK generators to consume the spec
 */
export const GET: RequestHandler = async () => {
	try {
		// Cache the parsed spec to avoid re-parsing on every request
		if (!cachedSpec) {
			const specPath = join(process.cwd(), 'openapi', 'openapi.yaml');
			const yamlContent = readFileSync(specPath, 'utf-8');
			cachedSpec = parse(yamlContent);
		}

		return json(cachedSpec, {
			headers: {
				'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
				'Access-Control-Allow-Origin': '*' // Allow CORS for tools
			}
		});
	} catch (error) {
		return json(
			{
				error: 'Failed to load OpenAPI specification',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{
				status: 500
			}
		);
	}
};
