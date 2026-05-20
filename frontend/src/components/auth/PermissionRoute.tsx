import { Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';

interface PermissionRouteProps {
    anyOf?: string[];
    allOf?: string[];
    feature?: string;
}

function AccessDenied() {
    return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh', padding: '32px' }}>
            <div style={{ maxWidth: '480px', textAlign: 'center' }}>
                <div
                    style={{
                        width: '64px',
                        height: '64px',
                        margin: '0 auto 16px',
                        borderRadius: '20px',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: 'var(--color-danger, #ef4444)',
                    }}
                >
                    <ShieldAlert size={28} />
                </div>
                <h1 style={{ marginBottom: '8px' }}>Access Restricted</h1>
                <p style={{ opacity: 0.75, lineHeight: 1.6 }}>
                    Your current role for the active branch does not allow this workflow.
                    Switch to an authorized branch or use an account with the required permission set.
                </p>
            </div>
        </div>
    );
}

export function PermissionRoute({ anyOf, allOf, feature }: PermissionRouteProps) {
    const access = usePermissionAccess();
    const matchesAny = !anyOf?.length || access.hasAnyPermission(anyOf);
    const matchesAll = !allOf?.length || access.hasAllPermissions(allOf);
    const matchesPermissionRules = matchesAny && matchesAll;
    const matchesFeature = !feature || access.hasModuleAccess(feature) || matchesPermissionRules;

    if (matchesPermissionRules && matchesFeature) {
        return <Outlet />;
    }

    return <AccessDenied />;
}
