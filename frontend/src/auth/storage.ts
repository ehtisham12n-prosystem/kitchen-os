const AUTH_SESSION_KEYS = [
    'access_token',
    'isLoggedIn',
    'user_type',
    'user_context',
] as const;

export type AuthSessionKey = (typeof AUTH_SESSION_KEYS)[number];

export function readAuthSessionItem(key: AuthSessionKey): string | null {
    const sessionValue = sessionStorage.getItem(key);
    const localValue = localStorage.getItem(key);
    const value = sessionValue ?? localValue;

    if (value !== null) {
        if (sessionValue !== value) {
            sessionStorage.setItem(key, value);
        }
        if (localValue !== value) {
            localStorage.setItem(key, value);
        }
    }

    return value;
}

export function hydrateAuthSession(): boolean {
    let changed = false;

    for (const key of AUTH_SESSION_KEYS) {
        const sessionValue = sessionStorage.getItem(key);
        const localValue = localStorage.getItem(key);
        const value = sessionValue ?? localValue;

        if (value === null) {
            continue;
        }

        if (sessionValue !== value) {
            sessionStorage.setItem(key, value);
            changed = true;
        }

        if (localValue !== value) {
            localStorage.setItem(key, value);
            changed = true;
        }
    }

    const hasToken = !!(sessionStorage.getItem('access_token') || localStorage.getItem('access_token'));
    const loggedIn = sessionStorage.getItem('isLoggedIn') ?? localStorage.getItem('isLoggedIn');

    if (hasToken && loggedIn !== 'true') {
        sessionStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        changed = true;
    }

    return changed;
}

export function setAuthSessionItem(key: AuthSessionKey, value: string): void {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
}

export function removeAuthSessionItem(key: AuthSessionKey): void {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
}

export function clearAuthSession(): void {
    for (const key of AUTH_SESSION_KEYS) {
        removeAuthSessionItem(key);
    }
}
