import type { RequestHandler } from './$types';

// Proxy route for api.emitkit.com/v1/identify → /api/v1/identify
export { POST } from '../../api/v1/identify/+server';
