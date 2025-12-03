import { auth } from '$lib/server/auth';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * PWA-specific magic link verification endpoint
 *
 * This endpoint:
 * 1. Verifies the magic link token
 * 2. Returns a page with JavaScript that opens the PWA with session info
 *
 * The page uses window.postMessage to communicate with the PWA
 * and provides a manual "Open App" button as fallback
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return new Response(
			`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>Authentication Error</title>
				<style>
					body { font-family: system-ui; padding: 2rem; text-align: center; }
					.error { color: #dc2626; }
				</style>
			</head>
			<body>
				<h1 class="error">Invalid Link</h1>
				<p>This authentication link is missing required information.</p>
				<a href="/auth/sign-in">Return to Sign In</a>
			</body>
			</html>
		`,
			{ status: 400, headers: { 'Content-Type': 'text/html' } }
		);
	}

	try {
		// Verify the magic link token - this automatically sets the session cookie
		const verifyResponse = await auth.api.magicLinkVerify({
			query: { token },
			headers: request.headers,
			asResponse: true // Get full response to access headers
		});

		if (!verifyResponse.ok) {
			throw new Error('Invalid token');
		}

		// Extract Set-Cookie headers from the response
		const setCookieHeader = verifyResponse.headers.get('set-cookie');

		// Return HTML page that redirects to PWA
		return new Response(
			`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>Opening App...</title>
				<style>
					body {
						font-family: system-ui;
						padding: 2rem;
						text-align: center;
						background: #0f172a;
						color: white;
						min-height: 100vh;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
					}
					.spinner {
						border: 4px solid rgba(255,255,255,0.1);
						border-top-color: white;
						border-radius: 50%;
						width: 40px;
						height: 40px;
						animation: spin 1s linear infinite;
						margin: 0 auto 1rem;
					}
					@keyframes spin {
						to { transform: rotate(360deg); }
					}
					.button {
						display: inline-block;
						margin-top: 2rem;
						padding: 0.75rem 1.5rem;
						background: white;
						color: #0f172a;
						text-decoration: none;
						border-radius: 0.5rem;
						font-weight: 600;
					}
					.success {
						color: #10b981;
					}
				</style>
			</head>
			<body>
				<div class="spinner"></div>
				<h1>Authentication Successful!</h1>
				<p id="status">Opening app...</p>
				<a href="/" class="button" id="openApp">Open App</a>

				<script>
					// Try to open the PWA
					setTimeout(() => {
						window.location.href = '/';
					}, 1000);

					// Update status after a delay
					setTimeout(() => {
						document.getElementById('status').textContent = 'If the app doesn\\'t open automatically, click the button above.';
					}, 2000);
				</script>
			</body>
			</html>
		`,
			{
				status: 200,
				headers: {
					'Content-Type': 'text/html',
					// Forward the session cookie
					...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {})
				}
			}
		);
	} catch (error) {
		console.error('Magic link verification error:', error);

		return new Response(
			`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>Authentication Error</title>
				<style>
					body { font-family: system-ui; padding: 2rem; text-align: center; }
					.error { color: #dc2626; }
				</style>
			</head>
			<body>
				<h1 class="error">Authentication Failed</h1>
				<p>This link may have expired or is invalid.</p>
				<a href="/auth/sign-in">Return to Sign In</a>
			</body>
			</html>
		`,
			{ status: 400, headers: { 'Content-Type': 'text/html' } }
		);
	}
};
