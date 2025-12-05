import type { Event } from '$lib/server/db/schema';
import { createLogger } from '$lib/server/logger';

const logger = createLogger('email-integration');

export async function sendEmailNotification(
	config: Record<string, unknown>,
	event: Event
): Promise<void> {
	const email = config.email as string;

	if (!email) {
		throw new Error('Email not configured');
	}

	// TODO: Implement email sending (Resend, SendGrid, etc.)
	logger.info('Email notification would be sent', {
		email,
		eventId: event.id,
		eventTitle: event.title
	});

	throw new Error('Email integration not yet implemented');
}
