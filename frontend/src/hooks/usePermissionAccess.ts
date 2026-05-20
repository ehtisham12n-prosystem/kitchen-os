import { useEffect, useMemo, useState } from 'react';
import {
    APP_PERMISSIONS,
    normalizePermissionKey,
    parsePermissionKey,
    readStoredUserContext,
    resolvePrimaryBranchId,
    USER_CONTEXT_CHANGED_EVENT,
    type UserContext,
    type UserContextBranch,
} from '../auth/access';

const BRANCH_CHANGED_EVENT = 'branch_changed';

function resolveActiveBranchId(userContext: UserContext | null): number | null {
    const stored = localStorage.getItem('activeBranchId');
    if (stored) {
        const parsed = Number(stored);
        if (Number.isInteger(parsed) && parsed > 0) {
            return parsed;
        }
    }

    if (userContext?.active_branch_id) {
        return Number(userContext.active_branch_id);
    }

    return resolvePrimaryBranchId(userContext);
}

function mapFeatureToModules(featureKey: string): string[] {
    switch (featureKey) {
        case 'auth':
        case 'setup':
            return [
                'dashboard',
                'branch',
                'counter',
                'settings',
                'user',
                'role',
                'permission',
                'attendance',
                'hr',
                'audit',
                'subscription',
                'tax',
                'payment',
                'theme',
                'client',
            ];
        case 'pos':
            return ['pos', 'cashier', 'shift', 'day', 'kds', 'ordering', 'customer', 'report', 'order_search', 'credit_order'];
        case 'inventory':
            return ['inventory', 'inventory_count', 'inventory_location', 'wastage', 'asset', 'ledger'];
        case 'procurement':
            return ['procurement', 'vendor', 'payment', 'approval'];
        case 'accounting':
            return ['accounting', 'journal', 'coa', 'cash', 'voucher', 'bank', 'reconciliation', 'investor', 'loan', 'profit_distribution', 'report'];
        case 'seating':
            return ['seating', 'service'];
        case 'recipe':
            return ['recipe', 'catalog'];
        case 'analytics':
            return ['analytics', 'report', 'dashboard'];
        case 'crm':
            return ['customer', 'deal', 'catering'];
        default:
            return [featureKey];
    }
}

function buildClientAdminFallbackPermissions(allowedModules: string[]): string[] {
    if (allowedModules.includes('all')) {
        return ['all'];
    }

    const normalizedAllowedModules = allowedModules.map((moduleName) => moduleName.toLowerCase());
    const permissions = new Set<string>();

    if (normalizedAllowedModules.includes('catalog')) {
        permissions.add(APP_PERMISSIONS.CATALOG.READ);
        permissions.add(APP_PERMISSIONS.CATALOG.WRITE);
        permissions.add(APP_PERMISSIONS.CATALOG.RECIPE_READ);
        permissions.add(APP_PERMISSIONS.CATALOG.RECIPE_WRITE);
    }

    if (normalizedAllowedModules.some((moduleName) => ['auth', 'setup', 'branch'].includes(moduleName))) {
        permissions.add(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES);
        permissions.add(APP_PERMISSIONS.ADMIN.SETUP_COUNTERS);
        permissions.add(APP_PERMISSIONS.ADMIN.SETUP_MASTER);
        permissions.add(APP_PERMISSIONS.ADMIN.SECURITY_USERS);
        permissions.add(APP_PERMISSIONS.ADMIN.SECURITY_ROLES);
        permissions.add(APP_PERMISSIONS.ADMIN.SECURITY_ACCESS);
        permissions.add(APP_PERMISSIONS.HR.STAFF_READ);
        permissions.add(APP_PERMISSIONS.HR.STAFF_WRITE);
    }

    if (normalizedAllowedModules.includes('pos')) {
        permissions.add(APP_PERMISSIONS.POS.ORDER_CREATE);
        permissions.add(APP_PERMISSIONS.POS.ORDER_READ);
        permissions.add(APP_PERMISSIONS.POS.ORDER_TAKER);
        permissions.add(APP_PERMISSIONS.POS.ORDER_CANCEL);
        permissions.add(APP_PERMISSIONS.POS.ORDER_RETURN);
        permissions.add(APP_PERMISSIONS.POS.DAY_MANAGE);
        permissions.add(APP_PERMISSIONS.POS.SHIFT_MANAGE);
        permissions.add(APP_PERMISSIONS.POS.TILL_MANAGE);
        permissions.add(APP_PERMISSIONS.POS.CASHIER_CONSOLE);
        permissions.add(APP_PERMISSIONS.POS.CREDIT_SETTLE);
        permissions.add(APP_PERMISSIONS.POS.RECEIPTS_PRINT);
        permissions.add(APP_PERMISSIONS.POS.KDS_READ);
        permissions.add(APP_PERMISSIONS.POS.REPORTS);
    }

    if (normalizedAllowedModules.includes('inventory')) {
        permissions.add(APP_PERMISSIONS.INVENTORY.READ);
        permissions.add(APP_PERMISSIONS.INVENTORY.SETUP);
        permissions.add(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST);
        permissions.add(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE);
        permissions.add(APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_VIEW);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_PERFORM);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_REVIEW);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_RECONCILE);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_REPORT);
        permissions.add(APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS);
        permissions.add(APP_PERMISSIONS.INVENTORY.MONTH_CLOSE);
        permissions.add(APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE);
        permissions.add(APP_PERMISSIONS.INVENTORY.WASTAGE);
        permissions.add(APP_PERMISSIONS.INVENTORY.ASSETS);
        permissions.add(APP_PERMISSIONS.INVENTORY.LEDGER);
    }

    if (normalizedAllowedModules.includes('procurement')) {
        permissions.add(APP_PERMISSIONS.PROCUREMENT.VENDORS);
        permissions.add(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE);
        permissions.add(APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS);
        permissions.add(APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE);
        permissions.add(APP_PERMISSIONS.PROCUREMENT.PAYMENTS);
        permissions.add(APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE);
    }

    if (normalizedAllowedModules.includes('accounting')) {
        permissions.add(APP_PERMISSIONS.ACCOUNTING.DASHBOARD);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.COA);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.COA_MANAGE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.JOURNAL_APPROVE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.LEDGER);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.PETTY_CASH);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.VOUCHER);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.BANKS);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.RECON);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.REPORTS);
        permissions.add(APP_PERMISSIONS.ACCOUNTING.SETTINGS);
    }

    if (normalizedAllowedModules.includes('crm')) {
        permissions.add(APP_PERMISSIONS.CRM.CUSTOMERS);
        permissions.add(APP_PERMISSIONS.CRM.CUSTOMERS_CREATE);
        permissions.add(APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE);
        permissions.add(APP_PERMISSIONS.CRM.DEALS);
        permissions.add(APP_PERMISSIONS.CRM.DEALS_MANAGE);
        permissions.add(APP_PERMISSIONS.CRM.CATERING);
        permissions.add(APP_PERMISSIONS.CRM.CATERING_MANAGE);
    }

    if (normalizedAllowedModules.includes('analytics')) {
        permissions.add(APP_PERMISSIONS.ADMIN.ANALYTICS);
        permissions.add(APP_PERMISSIONS.POS.REPORTS);
    }

    return Array.from(permissions);
}

export function usePermissionAccess() {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const refresh = () => setVersion((current) => current + 1);
        window.addEventListener(BRANCH_CHANGED_EVENT, refresh);
        window.addEventListener(USER_CONTEXT_CHANGED_EVENT, refresh);
        return () => {
            window.removeEventListener(BRANCH_CHANGED_EVENT, refresh);
            window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, refresh);
        };
    }, []);

    return useMemo(() => {
        void version;
        const userContext = readStoredUserContext();
        const allowedBranches = userContext?.allowed_branches ?? [];
        const activeBranchId = resolveActiveBranchId(userContext);
        const activeBranch =
            allowedBranches.find((branch) => Number(branch.branch_id) === Number(activeBranchId))
            ?? allowedBranches.find((branch) => branch.is_primary)
            ?? allowedBranches[0]
            ?? null;

        const allowedModules = [...new Set(activeBranch?.allowed_modules ?? userContext?.allowed_modules ?? [])];
        const rawPermissions = [...new Set(activeBranch?.effective_permissions ?? userContext?.effective_permissions ?? [])]
            .map((permission) => normalizePermissionKey(permission))
            .filter(Boolean);
        const effectivePermissions = userContext?.is_system
            ? ['all']
            : rawPermissions.length > 0
                ? rawPermissions
                : userContext?.organization_user_type === 'CLIENT_ADMIN'
                    ? buildClientAdminFallbackPermissions(allowedModules).map((permission) => normalizePermissionKey(permission))
                    : [];
        const permissionSet = new Set(effectivePermissions);

        const hasModuleAccess = (moduleKey: string) => {
            if (userContext?.is_system === true || allowedModules.includes('all')) {
                return true;
            }

            return mapFeatureToModules(moduleKey).some((candidate) => {
                if (allowedModules.includes(candidate)) {
                    return true;
                }

                return effectivePermissions.some((permission) => parsePermissionKey(permission).module === candidate);
            });
        };

        const hasPermission = (permission: string, branchId?: number | string | null) => {
            if (userContext?.is_system === true || permissionSet.has('all')) {
                return true;
            }

            if (branchId !== undefined && branchId !== null && branchId !== '' && !canAccessBranch(branchId)) {
                return false;
            }

            return permissionSet.has(normalizePermissionKey(permission));
        };

        const resolveScopeFallback = (scope: string) => {
            switch (scope) {
                case 'own':
                    return ['own', 'branch', 'company'];
                case 'branch':
                    return ['branch', 'company'];
                default:
                    return ['company'];
            }
        };

        const hasModulePermission = (
            moduleKey: string,
            action: string = 'view',
            scope: 'company' | 'branch' | 'own' = 'branch',
            branchId?: number | string | null,
        ) => {
            if (userContext?.is_system === true || permissionSet.has('all')) {
                return true;
            }

            if (branchId !== undefined && branchId !== null && branchId !== '' && !canAccessBranch(branchId)) {
                return false;
            }

            const normalizedModule = String(moduleKey || '').trim().toLowerCase();
            if (!normalizedModule) {
                return false;
            }

            return resolveScopeFallback(scope).some((candidateScope) =>
                hasPermission(`${normalizedModule}.${action}.${candidateScope}`, branchId)
                || hasPermission(`${normalizedModule}.manage.${candidateScope}`, branchId),
            );
        };

        const hasAnyPermission = (permissions: string[], branchId?: number | string | null) =>
            permissions.some((permission) => hasPermission(permission, branchId));

        const hasAllPermissions = (permissions: string[], branchId?: number | string | null) =>
            permissions.every((permission) => hasPermission(permission, branchId));

        const canAccessBranch = (branchId?: number | string | null) => {
            if (userContext?.is_system === true || branchId === undefined || branchId === null || branchId === '') {
                return true;
            }

            return allowedBranches.some((branch) => Number(branch.branch_id) === Number(branchId));
        };

        const canAccessModule = (
            moduleKey: string,
            scope: 'company' | 'branch' | 'own' = 'branch',
            branchId?: number | string | null,
        ) => (
            hasModulePermission(moduleKey, 'view', scope, branchId)
            || hasModulePermission(moduleKey, 'manage', scope, branchId)
            || hasModuleAccess(moduleKey)
        );

        const getModuleActions = (
            moduleKey: string,
            scope: 'company' | 'branch' | 'own' = 'branch',
            branchId?: number | string | null,
        ) => ({
            view: hasModulePermission(moduleKey, 'view', scope, branchId),
            create: hasModulePermission(moduleKey, 'create', scope, branchId),
            edit: hasModulePermission(moduleKey, 'edit', scope, branchId),
            delete: hasModulePermission(moduleKey, 'delete', scope, branchId),
            approve: hasModulePermission(moduleKey, 'approve', scope, branchId),
            manage: hasModulePermission(moduleKey, 'manage', scope, branchId),
        });

        return {
            userContext,
            allowedBranches,
            activeBranchId,
            activeBranch,
            effectivePermissions,
            allowedModules,
            hasModuleAccess,
            canAccessModule,
            isSystemAdmin: userContext?.is_system === true,
            hasPermission,
            hasModulePermission,
            hasAnyPermission,
            hasAllPermissions,
            getModuleActions,
            canAccessBranch,

            canAccessAdminControls: hasAnyPermission([
                APP_PERMISSIONS.ADMIN.SECURITY_USERS,
                APP_PERMISSIONS.ADMIN.SECURITY_ROLES,
                APP_PERMISSIONS.ADMIN.SECURITY_ACCESS,
                APP_PERMISSIONS.ADMIN.SETUP_BRANCHES,
                APP_PERMISSIONS.ADMIN.SETUP_COUNTERS,
            ]),
            canManageUsers: hasPermission(APP_PERMISSIONS.ADMIN.SECURITY_USERS),
            canManageRoles: hasPermission(APP_PERMISSIONS.ADMIN.SECURITY_ROLES),

            canReadCatalog: hasAnyPermission([APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE]),
            canManageCatalog: hasPermission(APP_PERMISSIONS.CATALOG.WRITE),

            canReadInventory: hasPermission(APP_PERMISSIONS.INVENTORY.READ),
            canAdjustInventory: hasPermission(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST),
            canReceiveInventory: hasPermission(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE),
            canManageTransfers: hasAnyPermission([
                APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER,
                APP_PERMISSIONS.INVENTORY.STOCK_ADJUST,
            ]),
            canViewBlindCounts: hasAnyPermission([
                APP_PERMISSIONS.INVENTORY.COUNT_VIEW,
                APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE,
                APP_PERMISSIONS.INVENTORY.COUNT_PERFORM,
                APP_PERMISSIONS.INVENTORY.COUNT_REVIEW,
                APP_PERMISSIONS.INVENTORY.COUNT_RECONCILE,
                APP_PERMISSIONS.INVENTORY.COUNT_REPORT,
                APP_PERMISSIONS.INVENTORY.MONTH_CLOSE,
            ]),
            canScheduleBlindCounts: hasPermission(APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE),
            canPerformBlindCounts: hasPermission(APP_PERMISSIONS.INVENTORY.COUNT_PERFORM),
            canReviewBlindCounts: hasAnyPermission([
                APP_PERMISSIONS.INVENTORY.COUNT_REVIEW,
                APP_PERMISSIONS.INVENTORY.COUNT_RECONCILE,
            ]),
            canReportBlindCounts: hasAnyPermission([
                APP_PERMISSIONS.INVENTORY.COUNT_REPORT,
                APP_PERMISSIONS.INVENTORY.MONTH_CLOSE,
            ]),
            canCloseInventoryMonth: hasPermission(APP_PERMISSIONS.INVENTORY.MONTH_CLOSE),
            canViewAssets: hasAnyPermission([
                APP_PERMISSIONS.INVENTORY.ASSETS_VIEW,
                APP_PERMISSIONS.INVENTORY.ASSETS,
            ]),
            canManageAssets: hasPermission(APP_PERMISSIONS.INVENTORY.ASSETS),
            canViewVendors: hasAnyPermission([
                APP_PERMISSIONS.PROCUREMENT.VENDORS,
                APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE,
            ]),
            canManageVendors: hasPermission(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE),
            canViewPurchaseOrders: hasAnyPermission([
                APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS,
                APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE,
                APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_APPROVE,
            ]),
            canManagePurchaseOrders: hasAnyPermission([
                APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE,
                APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_APPROVE,
            ]),
            canApprovePurchaseOrders: hasPermission(APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_APPROVE),
            canViewVendorPayments: hasAnyPermission([
                APP_PERMISSIONS.PROCUREMENT.PAYMENTS,
                APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE,
                APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE,
            ]),
            canManageVendorPayments: hasAnyPermission([
                APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE,
                APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE,
            ]),
            canApproveVendorPayments: hasPermission(APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE),

            canReadAccounting: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
                APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
                APP_PERMISSIONS.ACCOUNTING.REPORTS,
            ]),
            canPostAccounting: hasPermission(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE),
            canViewAccountingReports: hasPermission(APP_PERMISSIONS.ACCOUNTING.REPORTS),
            canViewChartOfAccounts: hasAnyPermission([APP_PERMISSIONS.ACCOUNTING.COA, APP_PERMISSIONS.ACCOUNTING.COA_MANAGE]),
            canManageChartOfAccounts: hasPermission(APP_PERMISSIONS.ACCOUNTING.COA_MANAGE),
            canViewGeneralLedger: hasAnyPermission([APP_PERMISSIONS.ACCOUNTING.LEDGER, APP_PERMISSIONS.ACCOUNTING.REPORTS]),
            canViewVouchers: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.VOUCHER,
                APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
                APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
                APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
                APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
            ]),
            canManageVouchers: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
                APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
            ]),
            canApproveVouchers: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
                APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
            ]),
            canViewPettyCash: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.PETTY_CASH,
                APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE,
            ]),
            canManagePettyCash: hasPermission(APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE),
            canViewBankAccounts: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.BANKS,
                APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
                APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
            ]),
            canManageBankAccounts: hasPermission(APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE),
            canViewBankReconciliation: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.RECON,
                APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE,
            ]),
            canApproveBankReconciliation: hasPermission(APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE),
            canManageAccountingSettings: hasPermission(APP_PERMISSIONS.ACCOUNTING.SETTINGS),
            canViewInvestors: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW,
                APP_PERMISSIONS.ACCOUNTING.INVESTORS,
            ]),
            canManageInvestors: hasPermission(APP_PERMISSIONS.ACCOUNTING.INVESTORS),
            canViewLoans: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW,
                APP_PERMISSIONS.ACCOUNTING.LOANS,
            ]),
            canManageLoans: hasPermission(APP_PERMISSIONS.ACCOUNTING.LOANS),
            canViewProfitDistribution: hasAnyPermission([
                APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW,
                APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
            ]),
            canManageProfitDistribution: hasPermission(APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION),
            canViewPayrollRuns: hasAnyPermission([
                APP_PERMISSIONS.HR.PAYROLL_READ,
                APP_PERMISSIONS.HR.PAYROLL_MANAGE,
                APP_PERMISSIONS.HR.PAYROLL_APPROVE,
            ]),
            canManagePayrollRuns: hasPermission(APP_PERMISSIONS.HR.PAYROLL_MANAGE),
            canApprovePayrollRuns: hasPermission(APP_PERMISSIONS.HR.PAYROLL_APPROVE),

            canViewCustomers: hasAnyPermission([
                APP_PERMISSIONS.CRM.CUSTOMERS,
                APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
            ]),
            canManageCustomers: hasAnyPermission([
                APP_PERMISSIONS.CRM.CUSTOMERS_CREATE,
                APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
            ]),
            canViewDeals: hasAnyPermission([
                APP_PERMISSIONS.CRM.DEALS,
                APP_PERMISSIONS.CRM.DEALS_MANAGE,
            ]),
            canManageDeals: hasPermission(APP_PERMISSIONS.CRM.DEALS_MANAGE),
            canViewCatering: hasAnyPermission([
                APP_PERMISSIONS.CRM.CATERING,
                APP_PERMISSIONS.CRM.CATERING_MANAGE,
            ]),
            canManageCatering: hasPermission(APP_PERMISSIONS.CRM.CATERING_MANAGE),

            canReadPos: hasPermission(APP_PERMISSIONS.POS.ORDER_READ),
            canOperatePos: hasPermission(APP_PERMISSIONS.POS.ORDER_CREATE),
            canUseOrderTakerPos: hasPermission(APP_PERMISSIONS.POS.ORDER_TAKER),
            canViewPosReports: hasPermission(APP_PERMISSIONS.POS.REPORTS),
            canCancelOrder: hasPermission(APP_PERMISSIONS.POS.ORDER_CANCEL),
            canReturnOrder: hasPermission(APP_PERMISSIONS.POS.ORDER_RETURN),
            canManageBranchDay: hasPermission(APP_PERMISSIONS.POS.DAY_MANAGE),
            canManageShifts: hasPermission(APP_PERMISSIONS.POS.SHIFT_MANAGE),
            canManageTillSessions: hasPermission(APP_PERMISSIONS.POS.TILL_MANAGE),
            canUseCashierConsole: hasPermission(APP_PERMISSIONS.POS.CASHIER_CONSOLE),
            canSettleCreditPayments: hasPermission(APP_PERMISSIONS.POS.CREDIT_SETTLE),
            canPrintPosReceipts: hasPermission(APP_PERMISSIONS.POS.RECEIPTS_PRINT),
            canUseKds: hasPermission(APP_PERMISSIONS.POS.KDS_READ),

            canReadStaff: hasPermission(APP_PERMISSIONS.HR.STAFF_READ),
            canManageStaff: hasPermission(APP_PERMISSIONS.HR.STAFF_WRITE),
            canMarkAttendance: hasPermission(APP_PERMISSIONS.HR.ATTENDANCE_MARK),

            canViewApprovals: hasPermission(APP_PERMISSIONS.APPROVAL.VIEW),
            canCreateApprovals: hasPermission(APP_PERMISSIONS.APPROVAL.CREATE),
            canReviewApprovals: hasPermission(APP_PERMISSIONS.APPROVAL.REVIEW),
            canApproveApprovals: hasPermission(APP_PERMISSIONS.APPROVAL.APPROVE),
            canRejectApprovals: hasPermission(APP_PERMISSIONS.APPROVAL.REJECT),
        };
    }, [version]);
}

export function usePermission() {
    return usePermissionAccess();
}

export function findBranchPermissions(
    branch: UserContextBranch | null | undefined,
    fallbackPermissions?: string[],
): string[] {
    return [...new Set(branch?.effective_permissions ?? fallbackPermissions ?? [])]
        .map((permission) => normalizePermissionKey(permission))
        .filter(Boolean);
}
