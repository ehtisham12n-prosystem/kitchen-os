function stripTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
    const configured = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configured) {
        return stripTrailingSlashes(configured);
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        console.warn('[KitchenOS POS] VITE_API_BASE_URL is not set. Falling back to same-origin /v1.');
        return `${stripTrailingSlashes(window.location.origin)}/v1`;
    }

    return '/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function apiUrl(path: string): string {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
