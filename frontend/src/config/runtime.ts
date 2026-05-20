function stripTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
    const configured = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configured) {
        return stripTrailingSlashes(configured);
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        if (!window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
            console.warn('[KitchenOS frontend] VITE_API_BASE_URL is not set. Falling back to same-origin /v1.');
            return `${stripTrailingSlashes(window.location.origin)}/v1`;
        }
    }

    // Default to the standard backend port if no VITE_API_BASE_URL is provided, especially on localhost
    return 'http://localhost:3000/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_PUBLIC_BASE_URL = API_BASE_URL.replace(/\/v1$/, '');

export function apiUrl(path: string): string {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function apiAssetUrl(path: string): string {
    if (!path) {
        return path;
    }
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    return `${API_PUBLIC_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
