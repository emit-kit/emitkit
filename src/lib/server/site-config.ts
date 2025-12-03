import { env } from '$env/dynamic/private';

// VERCEL_URL is just the domain without protocol (e.g., "localhost:5173" or "my-app.vercel.app")
const getAppUrl = () => {
	const protocol = import.meta.env.PROD ? 'https://' : 'http://';

	return `${protocol}${env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL}`;
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
