import type { RequestHandler } from './$types';

// Proxy route for api.emitkit.com/v1/events -> /api/v1/events
export { POST } from '../../api/v1/events/+server';
