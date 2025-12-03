import { TINYBIRD_TOKEN, TINYBIRD_API_URL } from '$env/static/private';

const TINYBIRD_BASE_URL = TINYBIRD_API_URL || 'https://api.tinybird.co';

export interface TinybirdEvent {
	id: string;
	channel_id: string;
	site_id: string;
	organization_id: string;
	retention_tier: string; // 'basic' | 'premium' | 'unlimited'
	title: string;
	description?: string;
	icon?: string;
	tags: string[];
	metadata: Record<string, unknown>;
	user_id?: string;
	notify: boolean;
	display_as: string;
	source: string;
	created_at: string; // ISO 8601 timestamp
}

export interface TinybirdIngestResponse {
	successful_rows: number;
	quarantined_rows: number;
}

class TinybirdClient {
	private token: string;
	private baseUrl: string;

	constructor(token: string, baseUrl: string = TINYBIRD_BASE_URL) {
		this.token = token;
		this.baseUrl = baseUrl;
	}

	/**
	 * Ingest a single event into Tinybird
	 *
	 * @param event - Event data matching TinybirdEvent schema
	 * @param wait - If true, waits for data to be committed before responding (slower but guaranteed)
	 * @returns Promise with ingestion response
	 */
	async ingestEvent(event: TinybirdEvent, wait: boolean = false): Promise<TinybirdIngestResponse> {
		const url = `${this.baseUrl}/v0/events?name=events${wait ? '&wait=true' : ''}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(event)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Tinybird ingestion failed: ${response.status} ${error}`);
		}

		return response.json();
	}

	/**
	 * Ingest multiple events in a single batch
	 *
	 * @param events - Array of events to ingest
	 * @param wait - If true, waits for data to be committed before responding
	 * @returns Promise with ingestion response
	 */
	async ingestEventBatch(
		events: TinybirdEvent[],
		wait: boolean = false
	): Promise<TinybirdIngestResponse> {
		const url = `${this.baseUrl}/v0/events?name=events${wait ? '&wait=true' : ''}`;

		// NDJSON format (one JSON object per line)
		const ndjson = events.map((e) => JSON.stringify(e)).join('\n');

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/x-ndjson'
			},
			body: ndjson
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Tinybird batch ingestion failed: ${response.status} ${error}`);
		}

		return response.json();
	}

	/**
	 * Query a Tinybird pipe (API endpoint)
	 *
	 * @param pipeName - Name of the pipe to query
	 * @param params - Query parameters
	 * @param format - Response format (json, csv, parquet, etc.)
	 * @returns Promise with query results
	 */
	async queryPipe<T = unknown>(
		pipeName: string,
		params: Record<string, string | number | boolean> = {},
		format: 'json' | 'csv' | 'ndjson' = 'json'
	): Promise<T> {
		const queryString = new URLSearchParams(
			Object.entries(params).reduce(
				(acc, [key, value]) => {
					acc[key] = String(value);
					return acc;
				},
				{} as Record<string, string>
			)
		).toString();

		const url = `${this.baseUrl}/v0/pipes/${pipeName}.${format}${queryString ? `?${queryString}` : ''}`;

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${this.token}`
			}
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Tinybird query failed: ${response.status} ${error}`);
		}

		if (format === 'json') {
			return response.json();
		}

		return response.text() as T;
	}

	/**
	 * Query a Tinybird pipe with POST (for larger parameter sets)
	 *
	 * @param pipeName - Name of the pipe to query
	 * @param params - Query parameters
	 * @returns Promise with query results
	 */
	async queryPipePost<T = unknown>(
		pipeName: string,
		params: Record<string, unknown> = {}
	): Promise<T> {
		const url = `${this.baseUrl}/v0/pipes/${pipeName}.json`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(params)
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Tinybird query failed: ${response.status} ${error}`);
		}

		return response.json();
	}
}

export const tinybird = new TinybirdClient(TINYBIRD_TOKEN);

export function isTinybirdEnabled(): boolean {
	return Boolean(TINYBIRD_TOKEN);
}
