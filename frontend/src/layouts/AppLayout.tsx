import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Outlet, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './AppLayout.module.css';
import {
    Settings,
    LogOut,
    Users,
    ShieldCheck,
    Utensils,
    Megaphone,
    X,
    ChevronDown,
    PanelLeftClose,
    PanelLeftOpen,
    GitBranch,
} from 'lucide-react';
import { ThemePicker } from '../components/ui/ThemePicker/ThemePicker';
import { useBranchContext, type AllowedBranch } from '../hooks/useBranchContext';
import { usePermissionAccess } from '../hooks/usePermissionAccess';
import { apiAssetUrl, apiUrl, authApi } from '../api/api';
import { persistUserContext, readStoredUserContext, resolveTenantSlug } from '../auth/access';
import { clearAuthSession, readAuthSessionItem, setAuthSessionItem } from '../auth/storage';
import {
    ADMIN_SIDEBAR,
    BRANCH_SIDEBAR,
    resolveSidebarPath,
    SYSTEM_SIDEBAR,
    type SidebarItemDefinition,
    type SidebarSectionDefinition,
} from '../navigation/sidebarRegistry';

/*
  Portal Reference:
  - userType === 'system'  -> Nexus (Platform Dashboard)
  - userType === 'client'  -> Console — has BOTH Admin + Branch access → toggle pill shown
  - userType === 'staff'   -> Console — Branch Level only, no toggle
  - userType === 'customer'-> Customer Portal

  TODO: Replace userType-based access check with permissions[] from JWT payload
        when RBAC module is complete. Pattern:
          const hasAdminAccess = permissions.includes('admin.access');
          const hasBranchAccess = permissions.includes('branch.access');
          const canToggle = hasAdminAccess && hasBranchAccess;
*/

const nl = ({ isActive }: { isActive: boolean }) =>
    `${styles.navLink} ${isActive ? styles.active : ''}`;

type TenantBranch = {
    id: number;
    branch_name: string;
    branch_code?: string | null;
};

type TenantBranding = {
    show_header_short_logo?: boolean;
    short_logo_url?: string | null;
};

type TenantInfo = {
    branches?: TenantBranch[];
    branding?: TenantBranding | null;
    short_name?: string | null;
    client_name?: string | null;
};

type BroadcastState = {
    active?: boolean;
    type?: string;
    title?: string;
    message?: string;
};

function NavSection({
    id,
    label,
    isOpen,
    onToggle,
    children,
}: {
    id: string;
    label: string;
    isOpen: boolean;
    onToggle: (id: string) => void;
    children: ReactNode;
}) {
    return (
        <div className={styles.navSectionWrapper}>
            <div
                className={styles.navSectionHeader}
                onClick={() => onToggle(id)}
            >
                <span className={styles.navSectionLabel}>{label}</span>
                <ChevronDown
                    size={14}
                    className={`${styles.sectionChevron} ${isOpen ? styles.sectionChevronExpanded : ''}`}
                />
            </div>
            <div className={`${styles.navSectionContent} ${isOpen ? styles.navSectionContentExpanded : styles.navSectionContentCollapsed}`}>
                {children}
            </div>
        </div>
    );
}

function NavLevel({
    icon,
    title,
    subtitle,
    className,
}: {
    icon: ReactNode;
    title: string;
    subtitle: string;
    className: string;
}) {
    return (
        <div className={`${styles.navLevelHeader} ${className}`}>
            <div className={styles.navLevelIcon}>{icon}</div>
            <div className={styles.navLevelText}>
                <span className={styles.navLevelTitle}>{title}</span>
                <span className={styles.navLevelSubtitle}>{subtitle}</span>
            </div>
        </div>
    );
}

export function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const userContext = readStoredUserContext();
    const access = usePermissionAccess();

    // Branch context from Phase 2 JWT (allowed_branches[])
    const { branches, activeBranch, setActiveBranch, isClientAdmin, isSystemAdmin } = useBranchContext();
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLElement>(null);
    const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
    const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => localStorage.getItem('console_sidebar_hidden') === 'true');

    const userType = readAuthSessionItem('user_type') || 'client';

    // If client admin and no explicit branches assigned, fallback to all client branches
    const displayBranches: AllowedBranch[] = (isClientAdmin || userType === 'client') && branches.length === 0 && tenantInfo?.branches
        ? tenantInfo.branches.map((branch: TenantBranch) => ({
            branch_id: branch.id,
            branch_name: branch.branch_name,
            role_id: null,
            role_name: 'Administrator',
            is_primary: branch.branch_code === 'MAIN-01'
        }))
        : branches;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
                setIsBranchDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Preserve nav scroll position
    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;

        const handleScroll = () => {
            sessionStorage.setItem('sidebar_scroll_pos', nav.scrollTop.toString());
        };

        nav.addEventListener('scroll', handleScroll);

        const savedPos = sessionStorage.getItem('sidebar_scroll_pos');
        if (savedPos) {
            setTimeout(() => {
                if (navRef.current) {
                    navRef.current.scrollTop = parseInt(savedPos, 10);
                }
            }, 10);
        }

        return () => nav.removeEventListener('scroll', handleScroll);
    }, [location.pathname]);

    const isNexus = window.location.pathname.startsWith('/nexus');
    const isTerminal = location.pathname === '/terminal';

    // UI Portal Identity
    const isSystem = isNexus; // Sidebar/Header branding follows path
    const isKDS = location.pathname.includes('/kds');
    const isOrderTaker = location.pathname.includes('/order-taker');
    const isPosTerminal = location.pathname.includes('/terminal/pos');
    const isFullscreenApp = isKDS || isOrderTaker || isPosTerminal;
    const readableConsolePathSuffixes = [
        '/admin/users',
        '/admin/security',
        '/setup/branches',
        '/setup/designations',
        '/setup/departments',
        '/setup/master',
        '/admin/architecture',
        '/inventory/vendors',
        '/inventory/vendor-payments',
        '/purchase-orders',
        '/accounting/chart-of-accounts',
        '/accounting/journal-entries',
        '/accounting/general-ledger',
        '/accounting/petty-cash',
        '/accounting/vouchers',
        '/accounting/voucher-approvals',
        '/finance/reconciliation',
        '/accounting/investors',
        '/accounting/investments',
        '/accounting/profit-distribution',
        '/accounting/loans',
        '/accounting/loan-repayments',
        '/admin/taxes',
        '/accounting/settings',
        '/seating/layout',
    ];
    const needsReadableConsoleText = location.pathname.startsWith('/console/')
        && readableConsolePathSuffixes.some((suffix) => location.pathname.endsWith(suffix));
    const outletKey = isFullscreenApp
        ? `fullscreen:${location.pathname}`
        : `${activeBranch?.branch_id ?? 'no-branch'}:${location.pathname}`;

    const canSeeCatalog = access.canReadCatalog;
    const canSeeInventory = access.canReadInventory;
    const canSeeAccounting = access.canReadAccounting;
    const canSeeStaff = access.canReadStaff;
    const canSeeAdminSecurity = access.canAccessAdminControls;
    const canSeePos = access.canOperatePos || access.canCancelOrder || access.canReturnOrder;
    const showAdminSections =
        !isNexus &&
        (isSystemAdmin
            || canSeeAdminSecurity
            || canSeeCatalog
            || canSeeInventory
            || canSeeAccounting
            || canSeeStaff);

    const getRoleLabel = () => {
        if (isNexus) return 'Platform Admin';
        if (isSystemAdmin) return 'Platform Supervisor';
        if (canSeeAdminSecurity) return 'System Administrator';
        if (canSeeStaff) return 'Operations Manager';
        if (showAdminSections) return 'Executive User';
        if (canSeePos) return 'POS Operator';
        return 'Branch Staff';
    };

    const getBadgeLabel = () => {
        if (isNexus) return 'NEXUS';
        if (isTerminal) return 'TERMINAL';
        if (showAdminSections) return 'OPERATIONS';
        return 'BRANCH';
    };

    const getBadgeClass = () => {
        if (isNexus) return styles.badgeSystem;
        if (isTerminal) return styles.badgeBranch;
        if (showAdminSections) return styles.badgeAdmin;
        return styles.badgeBranch;
    };

    const { tenantSlug } = useParams();
    const resolvedTenantSlug = tenantSlug || resolveTenantSlug(userContext);
    const consoleBase = resolvedTenantSlug ? `/console/${resolvedTenantSlug}` : '/console';

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const isConsoleWorkspace = location.pathname.startsWith('/console');
    const accountBasePath = isConsoleWorkspace ? `${consoleBase}/account` : '/terminal/account';

    const handleLogout = () => {
        clearAuthSession();
        if (isSystem) {
            navigate('/nexus/auth');
        } else {
            navigate(resolvedTenantSlug ? `/console/${resolvedTenantSlug}/auth` : '/console/access-required');
        }
    };

    const isImpersonating = localStorage.getItem('is_impersonating') === 'true';
    const impersonatedClient = localStorage.getItem('impersonated_client_name');
    const restoreClientId = localStorage.getItem('impersonated_client_id');

    const handleStopImpersonation = () => {
        const restoreToken = localStorage.getItem('nexus_restore_token');
        const restoreUserType = localStorage.getItem('nexus_restore_user_type');

        localStorage.removeItem('is_impersonating');
        localStorage.removeItem('impersonated_client_name');
        localStorage.removeItem('impersonated_client_id');
        localStorage.removeItem('nexus_restore_token');
        localStorage.removeItem('nexus_restore_user_type');

        if (restoreToken) setAuthSessionItem('access_token', restoreToken);
        if (restoreUserType) setAuthSessionItem('user_type', restoreUserType);
        setAuthSessionItem('isLoggedIn', 'true');

        navigate(restoreClientId ? `/nexus/clients/${restoreClientId}` : '/nexus/clients');
        window.location.reload();
    };


    // ── Global Broadcast System ──
    const [broadcast, setBroadcast] = useState<BroadcastState | null>(() => {
        const saved = localStorage.getItem('nexus_broadcast');
        return saved ? JSON.parse(saved) as BroadcastState : null;
    });

    useEffect(() => {
        const refreshUserContext = async () => {
            if (!readAuthSessionItem('access_token')) {
                return;
            }

            try {
                const nextContext = await authApi.me();
                if (nextContext) {
                    persistUserContext(nextContext);
                }
            } catch (error) {
                console.warn('Failed to refresh user context', error);
            }
        };

        refreshUserContext();
    }, []);

    useEffect(() => {
        localStorage.setItem('console_sidebar_hidden', isSidebarHidden ? 'true' : 'false');
    }, [isSidebarHidden]);

    useEffect(() => {
        const fetchTenant = async () => {
            try {
                let url = '';
                if (userContext?.client_id) {
                    url = apiUrl(`/platform/clients/${userContext.client_id}`);
                } else if (tenantSlug) {
                    url = apiUrl(`/platform/clients/by-slug/${tenantSlug}`);
                }
                if (!url) return;

                const accessToken = readAuthSessionItem('access_token');
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });

                if (!res.ok || res.status === 204) {
                    console.warn('Tenant not found or empty response');
                    return;
                }

                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    console.warn('Expected JSON response, got', contentType);
                    return;
                }

                const data = await res.json() as (TenantInfo & { error?: unknown });
                if (data && !data.error) {
                    setTenantInfo(data);
                    // Fallback: if no branch is active/assigned in JWT, use the first one from client branches for admins
                    if (!activeBranch && (isClientAdmin || userType === 'client') && data.branches && data.branches.length > 0) {
                        setActiveBranch({
                            branch_id: data.branches[0].id,
                            branch_name: data.branches[0].branch_name,
                            role_id: null,
                            role_name: 'Administrator',
                            is_primary: data.branches[0].branch_code === 'MAIN-01'
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch tenant info', err);
            }
        };
        fetchTenant();
    }, [activeBranch, isClientAdmin, setActiveBranch, tenantSlug, userContext?.client_id, userType]);

    const dismissBroadcast = () => {
        setBroadcast(null);
        // In a real app, we'd marks as read in DB.
        // For local demo, we just remove from view but keep in localStorage for simplicity or clear it.
        const current = JSON.parse(localStorage.getItem('nexus_broadcast') || '{}') as BroadcastState;
        localStorage.setItem('nexus_broadcast', JSON.stringify({ ...current, active: false }));
    };

    // ── Collapsible Section State ──
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('nav_open_sections');
        return saved ? JSON.parse(saved) : {
            // Default open states
            'nexus_gov': true,
            'prod_menu': true,
            'daily_ops': true,
            'global_cfg': true,
        };
    });

    const toggleSection = (id: string) => {
        setOpenSections(prev => {
            const newState = { ...prev, [id]: !prev[id] };
            localStorage.setItem('nav_open_sections', JSON.stringify(newState));
            return newState;
        });
    };

    const canSeeSidebarItem = (item: SidebarItemDefinition) => {
        if (item.allOf?.length && !access.hasAllPermissions(item.allOf)) {
            return false;
        }

        if (item.anyOf?.length && !access.hasAnyPermission(item.anyOf)) {
            return false;
        }

        if (item.moduleKeys?.length && !item.moduleKeys.some((moduleKey) => access.canAccessModule(moduleKey))) {
            return false;
        }

        return true;
    };

    const filterSidebarSections = (sections: SidebarSectionDefinition[]) => sections
        .map((section) => ({
            ...section,
            items: section.items.filter(canSeeSidebarItem),
        }))
        .filter((section) => section.items.length > 0);

    const visibleSystemSections = filterSidebarSections(SYSTEM_SIDEBAR.sections);
    const visibleAdminSections = filterSidebarSections(ADMIN_SIDEBAR.sections);
    const visibleBranchSections = filterSidebarSections(BRANCH_SIDEBAR.sections);

    const renderSidebarItem = (item: SidebarItemDefinition) => {
        const to = resolveSidebarPath(consoleBase, item.to);
        return (
            <NavLink
                key={item.key}
                to={to}
                className={nl}
                {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
                {item.icon}
                {item.label}
            </NavLink>
        );
    };

    return (
        <div className={styles.layout}>
            {!isFullscreenApp && !isSidebarHidden && (
              <aside className={`${styles.sidebar} ${isSystem ? styles.sidebarSystem : showAdminSections ? styles.sidebarAdmin : styles.sidebarBranch}`}>
                  <div className={styles.sidebarHeader}>
                      <h2>KitchenOS</h2>
                      <span className={`${styles.badge} ${getBadgeClass()}`}>
                          {getBadgeLabel()}
                      </span>
                  </div>

                {!isSystem && displayBranches.length > 0 && (
                    <div className={styles.branchSelectorWrapper} ref={branchDropdownRef}>
                        <button
                            className={styles.branchSelectorTrigger}
                            onClick={() => setIsBranchDropdownOpen(prev => !prev)}
                            title="Switch active branch"
                        >
                            <GitBranch size={14} className={styles.branchSelectorIcon} />
                            <span className={styles.branchSelectorName}>
                                {activeBranch?.branch_name ?? 'Select Branch'}
                            </span>
                            {displayBranches.length > 1 && <ChevronDown size={12} className={`${styles.sectionChevron} ${isBranchDropdownOpen ? styles.sectionChevronExpanded : ''}`} />}
                        </button>
                        {isBranchDropdownOpen && displayBranches.length > 1 && (
                            <div className={styles.branchDropdownList}>
                                {displayBranches.map((b) => (
                                    <button
                                        key={b.branch_id}
                                        className={`${styles.branchDropdownItem} ${activeBranch?.branch_id === b.branch_id ? styles.branchDropdownItemActive : ''}`}
                                        onClick={() => { setActiveBranch(b); setIsBranchDropdownOpen(false); }}
                                    >
                                        <GitBranch size={12} />
                                        {b.branch_name}
                                        {b.is_primary && <span className={styles.branchPrimaryBadge}>Primary</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <nav ref={navRef} className={styles.nav}>
                    {isSystem && visibleSystemSections.length > 0 && (
                        <>
                            {visibleSystemSections.map((section, index) => (
                                <div key={section.id}>
                                    {index > 0 && <div className={styles.navDivider} />}
                                    <NavSection
                                        id={section.id}
                                        label={section.label}
                                        isOpen={openSections[section.id] !== false}
                                        onToggle={toggleSection}
                                    >
                                        {section.items.map(renderSidebarItem)}
                                    </NavSection>
                                </div>
                            ))}
                        </>
                    )}

                    {!isSystem && visibleAdminSections.length > 0 && (
                        <div className={styles.adminNavGroup}>
                            <NavLevel
                                icon={ADMIN_SIDEBAR.icon}
                                title={ADMIN_SIDEBAR.title}
                                subtitle={ADMIN_SIDEBAR.subtitle}
                                className={styles.levelAdmin}
                            />
                            {visibleAdminSections.map((section, index) => (
                                <div key={section.id}>
                                    {index > 0 && <div className={styles.navDivider} />}
                                    <NavSection
                                        id={section.id}
                                        label={section.label}
                                        isOpen={openSections[section.id] !== false}
                                        onToggle={toggleSection}
                                    >
                                        {section.items.map(renderSidebarItem)}
                                    </NavSection>
                                </div>
                            ))}
                        </div>
                    )}

                    {!isSystem && visibleBranchSections.length > 0 && (
                        <div className={styles.branchNavGroup}>
                            <NavLevel
                                icon={BRANCH_SIDEBAR.icon}
                                title={BRANCH_SIDEBAR.title}
                                subtitle={activeBranch?.branch_name ?? BRANCH_SIDEBAR.subtitle}
                                className={styles.levelBranch}
                            />
                            {visibleBranchSections.map((section, index) => (
                                <div key={section.id}>
                                    {index > 0 && <div className={styles.navDivider} />}
                                    <NavSection
                                        id={section.id}
                                        label={section.label}
                                        isOpen={openSections[section.id] !== false}
                                        onToggle={toggleSection}
                                    >
                                        {section.items.map(renderSidebarItem)}
                                    </NavSection>
                                </div>
                            ))}
                        </div>
                    )}
                </nav>
              </aside>
            )}

            <div className={`${styles.mainWrapper} ${isFullscreenApp ? styles.fullscreenWrapper : ''}`}>
                {isImpersonating && (
                    <div className={styles.impersonationBanner}>
                        <div className={styles.bannerLeft}>
                            <ShieldCheck size={14} />
                            <span><strong>Support Impersonation Active:</strong> viewing <strong>{impersonatedClient}</strong> portal</span>
                        </div>
                        <button className={styles.stopImpersonateBtn} onClick={handleStopImpersonation}>
                            Stop Impersonation & Exit
                        </button>
                    </div>
                )}

                {broadcast && broadcast.active && !isSystem && (
                    <div className={`${styles.broadcastBanner} ${styles[`broadcast_${broadcast.type}`]}`}>
                        <Megaphone size={16} className={styles.broadcastIcon} />
                        <div className={styles.broadcastBody}>
                            <strong>{broadcast.title}:</strong> {broadcast.message}
                        </div>
                        <button className={styles.dismissBroadcast} onClick={dismissBroadcast}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                {!isFullscreenApp && (
                  <header className={`${styles.header} ${isSystem ? styles.headerSystem : showAdminSections ? styles.headerAdmin : styles.headerBranch}`}>
                      <div className={styles.headerLeft}>
                          {!isFullscreenApp ? (
                              <button
                                  type="button"
                                  className={styles.sidebarToggle}
                                  onClick={() => setIsSidebarHidden((prev) => !prev)}
                                  aria-label={isSidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
                                  title={isSidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
                              >
                                  {isSidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                              </button>
                          ) : null}
                          {isSystem ? (
                              <div className={styles.systemBrand}>
                                <ShieldCheck size={24} className={styles.brandLogoSystem} />
                                <span className={styles.brandName}>NEXUS</span>
                            </div>
                        ) : (
                            <div className={styles.clientBrand}>
                                <div className={styles.clientLogo}>
                                    {tenantInfo?.branding?.show_header_short_logo && tenantInfo?.branding?.short_logo_url
                                        ? <img src={apiAssetUrl(tenantInfo.branding.short_logo_url)} alt="Client short logo" className={styles.clientLogoImage} />
                                        : <Utensils size={20} />}
                                </div>
                                <div className={styles.clientBrandText}>
                                    <span className={styles.clientNameDisplay}>
                                        {isImpersonating ? impersonatedClient : (tenantInfo?.short_name || userContext?.short_name || tenantInfo?.client_name || userContext?.client_name || 'KitchenOS')}
                                    </span>
                                    {!isSystem && !isKDS && (
                                        <div className={styles.headerBranchSelector} ref={branchDropdownRef}>
                                            <button
                                                className={styles.headerBranchTrigger}
                                                onClick={() => setIsBranchDropdownOpen(p => !p)}
                                                title="Switch active branch"
                                            >
                                                <GitBranch size={13} />
                                                <span>{activeBranch?.branch_name ?? (displayBranches.length > 0 ? displayBranches[0].branch_name : 'Select Branch')}</span>
                                                {displayBranches.length > 1 && <ChevronDown size={11} className={`${styles.sectionChevron} ${isBranchDropdownOpen ? styles.sectionChevronExpanded : ''}`} />}
                                            </button>
                                            {isBranchDropdownOpen && displayBranches.length > 1 && (
                                                <div className={styles.headerBranchDropdown}>
                                                    {displayBranches.map((b) => (
                                                        <button
                                                            key={b.branch_id}
                                                            className={`${styles.headerBranchOption} ${activeBranch?.branch_id === b.branch_id ? styles.headerBranchOptionActive : ''}`}
                                                            onClick={() => { setActiveBranch(b); setIsBranchDropdownOpen(false); }}
                                                        >
                                                            <GitBranch size={12} />
                                                            {b.branch_name}
                                                            {b.is_primary && <span className={styles.branchPrimaryBadge}>Main</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.headerRight}>
                        <ThemePicker />
                        <div className={styles.userMenuWrapper}>
                            <div
                                className={styles.userTrigger}
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            >
                                <div className={styles.userInfo}>
                                    <span className={styles.userName}>{userContext?.username || 'User Account'}</span>
                                    <span className={styles.userRole}>{getRoleLabel()}</span>
                                </div>
                                <div className={styles.avatar}>
                                    {(userContext?.username || 'U').substring(0, 1).toUpperCase()}
                                </div>
                            </div>

                            {isUserMenuOpen && (
                                <>
                                    <div className={styles.menuOverlay} onClick={() => setIsUserMenuOpen(false)} />
                                    <div className={styles.userDropdown}>
                                        <div className={styles.dropdownHeader}>
                                            <div className={styles.dropdownAvatar}>
                                                {(userContext?.username || 'U').substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className={styles.dropdownUserDetails}>
                                                <strong>{userContext?.username || 'User Account'}</strong>
                                                <span>{userContext?.email || 'Manage your settings'}</span>
                                            </div>
                                        </div>

                                        <button className={styles.dropdownItem} onClick={() => { setIsUserMenuOpen(false); navigate(isSystem ? `/nexus/users/${userContext?.sub ?? ''}` : accountBasePath); }}>
                                            <Users size={16} />
                                            View Profile
                                        </button>
                                        <button className={styles.dropdownItem} onClick={() => { setIsUserMenuOpen(false); navigate(isSystem ? `/nexus/users/${userContext?.sub ?? ''}` : `${accountBasePath}?tab=security`); }}>
                                            <Settings size={16} />
                                            Security & PINs
                                        </button>

                                        <button className={`${styles.dropdownItem} ${styles.logoutAction}`} onClick={handleLogout}>
                                            <LogOut size={16} />
                                            Logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                  </header>
                )}

                <main className={`${styles.mainContent} ${isFullscreenApp ? styles.mainContentFullscreen : ''} ${needsReadableConsoleText ? styles.readableConsolePage : ''}`}>
                    <Outlet key={outletKey} />
                </main>
            </div>
        </div>
    );
}
