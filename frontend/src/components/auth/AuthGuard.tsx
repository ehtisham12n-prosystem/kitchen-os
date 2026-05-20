import { Navigate, useLocation } from 'react-router-dom';
import { hydrateAuthSession, readAuthSessionItem, removeAuthSessionItem } from '../../auth/storage';
import { readStoredUserContext, resolveTenantSlug } from '../../auth/access';

interface AuthGuardProps {
    children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
    const location = useLocation();
    hydrateAuthSession();
    const isLoggedIn = readAuthSessionItem('isLoggedIn') === 'true';
    const hasToken = !!readAuthSessionItem('access_token');
    const userType = readAuthSessionItem('user_type') || 'client';
    const pathParts = location.pathname.split('/').filter(Boolean);
    const userContext = readStoredUserContext();
    const storedTenantSlug = resolveTenantSlug(userContext);
    const consoleReserved = [
        'auth',
        'products',
        'setup',
        'seating',
        'inventory',
        'staff',
        'accounting',
        'crm',
        'marketing',
        'admin',
        'client',
        'finance',
        'reports',
        'analytics',
        'cashier',
        'order-taker',
        'production',
        'recipes',
        'purchase-orders',
        'profile',
        'account',
        'settings',
        'bm-dashboard',
    ];
    const hasConsoleSlug = pathParts[0] === 'console' && Boolean(pathParts[1]) && !consoleReserved.includes(pathParts[1]);
    const activeConsoleSlug = hasConsoleSlug ? pathParts[1] : null;
    const consoleTail = pathParts[0] !== 'console'
        ? ''
        : hasConsoleSlug
            ? pathParts.slice(2).join('/')
            : pathParts.slice(1).join('/');

    // If flag is set but token is missing, force a logout/redirect state
    if (!isLoggedIn || !hasToken) {
        if (isLoggedIn && !hasToken) {
            removeAuthSessionItem('isLoggedIn');
        }

        // Determine login path based on target namespace
        let loginPath = "/console/access-required";

        if (pathParts[0] === 'nexus') {
            loginPath = "/nexus/auth";
        } else if (pathParts[0] === 'menu') {
            loginPath = "/menu/auth";
        } else if (pathParts[0] === 'console' && activeConsoleSlug) {
            loginPath = `/console/${activeConsoleSlug}/auth`;
        }

        return <Navigate to={loginPath} state={{ from: location }} replace />;
    }

    if (pathParts[0] === 'nexus' && userType !== 'system') {
        return <Navigate to="/console" state={{ from: location, deniedPortal: 'nexus' }} replace />;
    }

    if (pathParts[0] === 'console' && userType !== 'system') {
        if (!storedTenantSlug) {
            return <Navigate to="/console/access-required" state={{ from: location }} replace />;
        }

        if (!activeConsoleSlug) {
            const nextPath = consoleTail ? `/console/${storedTenantSlug}/${consoleTail}` : `/console/${storedTenantSlug}`;
            return <Navigate to={nextPath} state={{ from: location }} replace />;
        }

        if (activeConsoleSlug !== storedTenantSlug) {
            const nextPath = consoleTail ? `/console/${storedTenantSlug}/${consoleTail}` : `/console/${storedTenantSlug}`;
            return <Navigate to={nextPath} state={{ from: location }} replace />;
        }
    }

    return <>{children}</>;
}
