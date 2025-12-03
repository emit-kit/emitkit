import { VERCEL_URL } from '$env/static/private';

// VERCEL_URL is just the domain without protocol (e.g., "localhost:5173" or "my-app.vercel.app")
const getAppUrl = () => {
	const protocol = import.meta.env.PROD ? 'https://' : 'http://';

	return `${protocol}${VERCEL_URL}`;
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
