import { env } from '$env/dynamic/private';

// VERCEL_URL is just the domain without protocol (e.g., "localhost:5173" or "my-app.vercel.app")
const getAppUrl = () => {
	const protocol = import.meta.env.PROD ? 'https://' : 'http://';

	// In production environment, use the production custom domain
	// Otherwise use the deployment-specific URL (preview/branch deployments)
	const isProductionEnv = env.VERCEL_TARGET_ENV === 'production';
	const domain = isProductionEnv && env.VERCEL_PROJECT_PRODUCTION_URL
		? env.VERCEL_PROJECT_PRODUCTION_URL
		: env.VERCEL_URL;

	const appUrl = `${protocol}${domain}`;

	// Log configuration on startup (helpful for debugging)
	if (import.meta.env.PROD) {
		console.log('[site-config] App URL configuration:', {
			appUrl,
			isProductionEnv,
			VERCEL_TARGET_ENV: env.VERCEL_TARGET_ENV,
			VERCEL_PROJECT_PRODUCTION_URL: env.VERCEL_PROJECT_PRODUCTION_URL,
			VERCEL_URL: env.VERCEL_URL
		});
	}

	return appUrl;
};

export const siteConfig = {
	appName: 'EmitKit',
	appUrl: getAppUrl(),
	flags: {
		darkMode: true
	},
	auth: {
		authPageImage: '/public/auth-screen.jpg'
	}
} as const;

export type SiteConfig = typeof siteConfig;
