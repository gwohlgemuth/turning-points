export const DEMO_PARAM = 'demo';

export const demoKey = (key: string, demo: boolean) => (demo ? `${key}-demo` : key);

const detect = () =>
	Boolean(import.meta.env.STATIC) &&
	typeof window !== 'undefined' &&
	new URLSearchParams(location.search).has(DEMO_PARAM);

export const demo = { active: detect() };

export const withDemo = (href: string) => (demo.active ? `${href}?${DEMO_PARAM}` : href);
