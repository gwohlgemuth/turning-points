const FLAG = 'turning-points-demo';

export const DEMO_PARAM = 'demo';

export const demoKey = (key: string, demo: boolean) => (demo ? `${key}-demo` : key);

function detect(): { active: boolean; entering: boolean } {
	if (!import.meta.env.STATIC || typeof window === 'undefined') {
		return { active: false, entering: false };
	}
	const entering = new URLSearchParams(location.search).has(DEMO_PARAM);
	try {
		if (entering) sessionStorage.setItem(FLAG, '1');
		return { active: entering || sessionStorage.getItem(FLAG) === '1', entering };
	} catch {
		return { active: entering, entering };
	}
}

export const demo = detect();

export function exitDemo(home: string): void {
	try {
		sessionStorage.removeItem(FLAG);
	} catch {
		// storage blocked: the flag was never kept either
	}
	location.href = home;
}
