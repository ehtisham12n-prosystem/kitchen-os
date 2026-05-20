import { readAuthSessionItem, setAuthSessionItem } from './storage';

export const USER_CONTEXT_CHANGED_EVENT = 'user_context_changed';

type PermissionScope = 'company' | 'branch' | 'own';

type PermissionRecord = {
    key: string;
    module: string;
    action: string;
    scope: PermissionScope;
};

function definePermission(module: string, action: string, scope: PermissionScope): PermissionRecord {
    return {
        key: `${module}.${action}.${scope}`,
        module,
        action,
        scope,
    };
}

const PERMISSIONS = {
    PLATFORM_VIEW: definePermission('platform', 'view', 'company'),
    PLATFORM_MANAGE: definePermission('platform', 'manage', 'company'),
    CLIENT_VIEW: definePermission('client', 'view', 'company'),
    CLIENT_MANAGE: definePermission('client', 'manage', 'company'),
    USER_VIEW: definePermission('user', 'view', 'company'),
    USER_MANAGE: definePermission('user', 'manage', 'company'),
    ROLE_VIEW: definePermission('role', 'view', 'company'),
    ROLE_MANAGE: definePermission('role', 'manage', 'company'),
    PERMISSION_VIEW: definePermission('permission', 'view', 'company'),
    PERMISSION_MANAGE: definePermission('permission', 'manage', 'company'),
    AUDIT_VIEW: definePermission('audit', 'view', 'company'),
    SUPPORT_VIEW: definePermission('support', 'view', 'company'),
    SUPPORT_MANAGE: definePermission('support', 'manage', 'company'),
    THEME_VIEW: definePermission('theme', 'view', 'company'),
    THEME_MANAGE: definePermission('theme', 'manage', 'company'),
    SUBSCRIPTION_VIEW: definePermission('subscription', 'view', 'company'),
    SUBSCRIPTION_MANAGE: definePermission('subscription', 'manage', 'company'),
    BRANCH_VIEW: definePermission('branch', 'view', 'company'),
    BRANCH_MANAGE: definePermission('branch', 'manage', 'company'),
    COUNTER_VIEW: definePermission('counter', 'view', 'company'),
    COUNTER_MANAGE: definePermission('counter', 'manage', 'company'),
    SETTINGS_VIEW: definePermission('settings', 'view', 'company'),
    SETTINGS_MANAGE: definePermission('settings', 'manage', 'company'),
    TAX_VIEW: definePermission('tax', 'view', 'company'),
    TAX_MANAGE: definePermission('tax', 'manage', 'company'),
    ANALYTICS_VIEW_COMPANY: definePermission('analytics', 'view', 'company'),
    ANALYTICS_VIEW_BRANCH: definePermission('analytics', 'view', 'branch'),
    DASHBOARD_VIEW_COMPANY: definePermission('dashboard', 'view', 'company'),
    DASHBOARD_VIEW_BRANCH: definePermission('dashboard', 'view', 'branch'),
    CATALOG_VIEW: definePermission('catalog', 'view', 'company'),
    CATALOG_CREATE: definePermission('catalog', 'create', 'company'),
    CATALOG_EDIT: definePermission('catalog', 'edit', 'company'),
    CATALOG_DELETE: definePermission('catalog', 'delete', 'company'),
    CATALOG_MANAGE: definePermission('catalog', 'manage', 'company'),
    RECIPE_VIEW: definePermission('recipe', 'view', 'company'),
    RECIPE_CREATE: definePermission('recipe', 'create', 'company'),
    RECIPE_EDIT: definePermission('recipe', 'edit', 'company'),
    RECIPE_DELETE: definePermission('recipe', 'delete', 'company'),
    RECIPE_MANAGE: definePermission('recipe', 'manage', 'company'),
    INVENTORY_VIEW: definePermission('inventory', 'view', 'branch'),
    INVENTORY_CREATE: definePermission('inventory', 'create', 'branch'),
    INVENTORY_EDIT: definePermission('inventory', 'edit', 'branch'),
    INVENTORY_APPROVE: definePermission('inventory', 'approve', 'branch'),
    INVENTORY_MANAGE: definePermission('inventory', 'manage', 'company'),
    INVENTORY_COUNT_VIEW: definePermission('inventory_count', 'view', 'branch'),
    INVENTORY_COUNT_SCHEDULE: definePermission('inventory_count', 'schedule', 'branch'),
    INVENTORY_COUNT_PERFORM: definePermission('inventory_count', 'perform', 'branch'),
    INVENTORY_COUNT_REVIEW: definePermission('inventory_count', 'review', 'branch'),
    INVENTORY_COUNT_RECONCILE: definePermission('inventory_count', 'reconcile', 'branch'),
    INVENTORY_COUNT_REPORT: definePermission('inventory_count', 'report', 'branch'),
    INVENTORY_COUNT_SETTINGS: definePermission('inventory_count', 'settings', 'company'),
    INVENTORY_LOCATION_MANAGE: definePermission('inventory_location', 'manage', 'company'),
    INVENTORY_MONTH_CLOSE: definePermission('inventory_count', 'month_close', 'branch'),
    WASTAGE_VIEW: definePermission('wastage', 'view', 'branch'),
    WASTAGE_CREATE: definePermission('wastage', 'create', 'branch'),
    WASTAGE_APPROVE: definePermission('wastage', 'approve', 'branch'),
    WASTAGE_MANAGE: definePermission('wastage', 'manage', 'branch'),
    ASSET_VIEW: definePermission('asset', 'view', 'branch'),
    ASSET_CREATE: definePermission('asset', 'create', 'branch'),
    ASSET_EDIT: definePermission('asset', 'edit', 'branch'),
    ASSET_DELETE: definePermission('asset', 'delete', 'branch'),
    ASSET_MANAGE: definePermission('asset', 'manage', 'branch'),
    LEDGER_VIEW: definePermission('ledger', 'view', 'branch'),
    VENDOR_VIEW: definePermission('vendor', 'view', 'company'),
    VENDOR_CREATE: definePermission('vendor', 'create', 'company'),
    VENDOR_EDIT: definePermission('vendor', 'edit', 'company'),
    VENDOR_DELETE: definePermission('vendor', 'delete', 'company'),
    VENDOR_MANAGE: definePermission('vendor', 'manage', 'company'),
    PROCUREMENT_VIEW: definePermission('procurement', 'view', 'branch'),
    PROCUREMENT_CREATE: definePermission('procurement', 'create', 'branch'),
    PROCUREMENT_EDIT: definePermission('procurement', 'edit', 'branch'),
    PROCUREMENT_DELETE: definePermission('procurement', 'delete', 'branch'),
    PROCUREMENT_APPROVE: definePermission('procurement', 'approve', 'branch'),
    PROCUREMENT_MANAGE: definePermission('procurement', 'manage', 'branch'),
    PAYMENT_VIEW_COMPANY: definePermission('payment', 'view', 'company'),
    PAYMENT_MANAGE_COMPANY: definePermission('payment', 'manage', 'company'),
    PAYMENT_APPROVE_COMPANY: definePermission('payment', 'approve', 'company'),
    ACCOUNTING_VIEW: definePermission('accounting', 'view', 'company'),
    ACCOUNTING_MANAGE: definePermission('accounting', 'manage', 'company'),
    JOURNAL_VIEW: definePermission('journal', 'view', 'company'),
    JOURNAL_CREATE: definePermission('journal', 'create', 'branch'),
    JOURNAL_EDIT: definePermission('journal', 'edit', 'branch'),
    JOURNAL_APPROVE: definePermission('journal', 'approve', 'company'),
    COA_VIEW: definePermission('coa', 'view', 'company'),
    COA_MANAGE: definePermission('coa', 'manage', 'company'),
    CASH_VIEW: definePermission('cash', 'view', 'branch'),
    PETTY_CASH_MANAGE: definePermission('cash', 'manage', 'branch'),
    VOUCHER_VIEW: definePermission('voucher', 'view', 'branch'),
    VOUCHER_MANAGE: definePermission('voucher', 'manage', 'branch'),
    VOUCHER_APPROVE: definePermission('voucher', 'approve', 'branch'),
    BANK_VIEW: definePermission('bank', 'view', 'company'),
    BANK_MANAGE: definePermission('bank', 'manage', 'company'),
    RECONCILIATION_VIEW: definePermission('reconciliation', 'view', 'company'),
    RECONCILIATION_APPROVE: definePermission('reconciliation', 'approve', 'company'),
    INVESTOR_VIEW: definePermission('investor', 'view', 'company'),
    INVESTOR_MANAGE: definePermission('investor', 'manage', 'company'),
    LOAN_VIEW: definePermission('loan', 'view', 'company'),
    LOAN_MANAGE: definePermission('loan', 'manage', 'company'),
    PROFIT_DISTRIBUTION_VIEW: definePermission('profit_distribution', 'view', 'company'),
    PROFIT_DISTRIBUTION_MANAGE: definePermission('profit_distribution', 'manage', 'company'),
    REPORT_VIEW: definePermission('report', 'view', 'branch'),
    HR_VIEW: definePermission('hr', 'view', 'branch'),
    HR_MANAGE: definePermission('hr', 'manage', 'company'),
    ATTENDANCE_VIEW: definePermission('attendance', 'view', 'branch'),
    ATTENDANCE_MANAGE: definePermission('attendance', 'manage', 'branch'),
    PAYROLL_VIEW: definePermission('payroll', 'view', 'branch'),
    PAYROLL_MANAGE: definePermission('payroll', 'manage', 'branch'),
    PAYROLL_APPROVE: definePermission('payroll', 'approve', 'branch'),
    POS_VIEW: definePermission('pos', 'view', 'branch'),
    POS_CREATE: definePermission('pos', 'create', 'branch'),
    POS_EDIT: definePermission('pos', 'edit', 'branch'),
    POS_APPROVE: definePermission('pos', 'approve', 'branch'),
    POS_MANAGE: definePermission('pos', 'manage', 'branch'),
    SHIFT_VIEW: definePermission('shift', 'view', 'branch'),
    SHIFT_MANAGE: definePermission('shift', 'manage', 'branch'),
    DAY_VIEW: definePermission('day', 'view', 'branch'),
    DAY_MANAGE: definePermission('day', 'manage', 'branch'),
    CASHIER_VIEW: definePermission('cashier', 'view', 'branch'),
    CASHIER_MANAGE: definePermission('cashier', 'manage', 'branch'),
    ORDER_SEARCH_VIEW: definePermission('order_search', 'view', 'branch'),
    CREDIT_ORDER_VIEW: definePermission('credit_order', 'view', 'branch'),
    CREDIT_ORDER_MANAGE: definePermission('credit_order', 'manage', 'branch'),
    BILL_VOID_VIEW: definePermission('bill_void', 'view', 'branch'),
    BILL_VOID_CREATE: definePermission('bill_void', 'create', 'branch'),
    BILL_VOID_APPROVE: definePermission('bill_void', 'approve', 'branch'),
    BILL_VOID_EXPORT: definePermission('bill_void', 'export', 'branch'),
    BILL_VOID_MANAGE: definePermission('bill_void', 'manage', 'branch'),
    USER_HISTORY_VIEW: definePermission('user_history', 'view', 'branch'),
    USER_HISTORY_TRANSACTIONS: definePermission('user_history', 'transactions', 'branch'),
    USER_HISTORY_AUDIT: definePermission('user_history', 'audit', 'branch'),
    USER_HISTORY_EXPORT: definePermission('user_history', 'export', 'branch'),
    KDS_VIEW: definePermission('kds', 'view', 'branch'),
    KDS_MANAGE: definePermission('kds', 'manage', 'branch'),
    ORDERING_VIEW: definePermission('ordering', 'view', 'branch'),
    SEATING_VIEW: definePermission('seating', 'view', 'branch'),
    SEATING_MANAGE: definePermission('seating', 'manage', 'branch'),
    SERVICE_VIEW: definePermission('service', 'view', 'branch'),
    SERVICE_MANAGE: definePermission('service', 'manage', 'branch'),
    CUSTOMER_VIEW: definePermission('customer', 'view', 'branch'),
    CUSTOMER_CREATE: definePermission('customer', 'create', 'branch'),
    CUSTOMER_EDIT: definePermission('customer', 'edit', 'branch'),
    CUSTOMER_DELETE: definePermission('customer', 'delete', 'branch'),
    CUSTOMER_MANAGE: definePermission('customer', 'manage', 'branch'),
    DEAL_VIEW: definePermission('deal', 'view', 'branch'),
    DEAL_MANAGE: definePermission('deal', 'manage', 'branch'),
    CATERING_VIEW: definePermission('catering', 'view', 'branch'),
    CATERING_MANAGE: definePermission('catering', 'manage', 'branch'),
    APPROVAL_VIEW: definePermission('approval', 'view', 'branch'),
    APPROVAL_CREATE: definePermission('approval', 'create', 'branch'),
    APPROVAL_APPROVE: definePermission('approval', 'approve', 'branch'),
    APPROVAL_MANAGE: definePermission('approval', 'manage', 'branch'),
} as const;

export const APP_PERMISSIONS = {
    PLATFORM: {
        VIEW: PERMISSIONS.PLATFORM_VIEW.key,
        SUPER_ADMIN: PERMISSIONS.PLATFORM_MANAGE.key,
        CLIENT_VIEW: PERMISSIONS.CLIENT_VIEW.key,
        CLIENT_MANAGE: PERMISSIONS.CLIENT_MANAGE.key,
        USER_VIEW: PERMISSIONS.USER_VIEW.key,
        USER_MANAGE: PERMISSIONS.USER_MANAGE.key,
        FINANCE_MANAGE: PERMISSIONS.ACCOUNTING_MANAGE.key,
        SUPPORT_READ: PERMISSIONS.SUPPORT_VIEW.key,
        SUPPORT_MANAGE: PERMISSIONS.SUPPORT_MANAGE.key,
        THEME_MANAGE: PERMISSIONS.THEME_MANAGE.key,
        AUDIT_READ: PERMISSIONS.AUDIT_VIEW.key,
    },
    ADMIN: {
        DASHBOARD: PERMISSIONS.DASHBOARD_VIEW_COMPANY.key,
        ANALYTICS: PERMISSIONS.ANALYTICS_VIEW_COMPANY.key,
        SETUP_BRANCHES: PERMISSIONS.BRANCH_MANAGE.key,
        SETUP_COUNTERS: PERMISSIONS.COUNTER_MANAGE.key,
        SETUP_MASTER: PERMISSIONS.SETTINGS_MANAGE.key,
        SECURITY_USERS: PERMISSIONS.USER_MANAGE.key,
        SECURITY_ROLES: PERMISSIONS.ROLE_MANAGE.key,
        SECURITY_ACCESS: PERMISSIONS.PERMISSION_MANAGE.key,
        AUDIT_READ: PERMISSIONS.AUDIT_VIEW.key,
        SUBSCRIPTION: PERMISSIONS.SUBSCRIPTION_VIEW.key,
        TAX_CONFIG: PERMISSIONS.TAX_MANAGE.key,
        PAYMENT_METHODS: PERMISSIONS.PAYMENT_MANAGE_COMPANY.key,
    },
    CATALOG: {
        READ: PERMISSIONS.CATALOG_VIEW.key,
        CREATE: PERMISSIONS.CATALOG_CREATE.key,
        EDIT: PERMISSIONS.CATALOG_EDIT.key,
        WRITE: PERMISSIONS.CATALOG_MANAGE.key,
        DELETE: PERMISSIONS.CATALOG_DELETE.key,
        CATEGORIES: PERMISSIONS.CATALOG_MANAGE.key,
        ARCHITECTURE: PERMISSIONS.CATALOG_MANAGE.key,
        RECIPE_READ: PERMISSIONS.RECIPE_VIEW.key,
        RECIPE_CREATE: PERMISSIONS.RECIPE_CREATE.key,
        RECIPE_EDIT: PERMISSIONS.RECIPE_EDIT.key,
        RECIPE_WRITE: PERMISSIONS.RECIPE_MANAGE.key,
    },
    INVENTORY: {
        DASHBOARD: PERMISSIONS.INVENTORY_VIEW.key,
        READ: PERMISSIONS.INVENTORY_VIEW.key,
        CREATE: PERMISSIONS.INVENTORY_CREATE.key,
        EDIT: PERMISSIONS.INVENTORY_EDIT.key,
        APPROVE: PERMISSIONS.INVENTORY_APPROVE.key,
        SETUP: PERMISSIONS.INVENTORY_MANAGE.key,
        STOCK_ADJUST: PERMISSIONS.INVENTORY_EDIT.key,
        STOCK_RECEIVE: PERMISSIONS.INVENTORY_CREATE.key,
        STOCK_TRANSFER: PERMISSIONS.INVENTORY_EDIT.key,
        WASTAGE: PERMISSIONS.WASTAGE_CREATE.key,
        APPROVALS: PERMISSIONS.APPROVAL_APPROVE.key,
        WASTAGE_APPROVE: PERMISSIONS.WASTAGE_APPROVE.key,
        ASSETS_VIEW: PERMISSIONS.ASSET_VIEW.key,
        ASSETS: PERMISSIONS.ASSET_MANAGE.key,
        LEDGER: PERMISSIONS.LEDGER_VIEW.key,
        COUNT_VIEW: PERMISSIONS.INVENTORY_COUNT_VIEW.key,
        COUNT_SCHEDULE: PERMISSIONS.INVENTORY_COUNT_SCHEDULE.key,
        COUNT_PERFORM: PERMISSIONS.INVENTORY_COUNT_PERFORM.key,
        COUNT_REVIEW: PERMISSIONS.INVENTORY_COUNT_REVIEW.key,
        COUNT_RECONCILE: PERMISSIONS.INVENTORY_COUNT_RECONCILE.key,
        COUNT_REPORT: PERMISSIONS.INVENTORY_COUNT_REPORT.key,
        COUNT_SETTINGS: PERMISSIONS.INVENTORY_COUNT_SETTINGS.key,
        LOCATIONS_MANAGE: PERMISSIONS.INVENTORY_LOCATION_MANAGE.key,
        MONTH_CLOSE: PERMISSIONS.INVENTORY_MONTH_CLOSE.key,
    },
    PROCUREMENT: {
        VENDORS: PERMISSIONS.VENDOR_VIEW.key,
        VENDORS_MANAGE: PERMISSIONS.VENDOR_MANAGE.key,
        PAYMENTS: PERMISSIONS.PAYMENT_VIEW_COMPANY.key,
        PAYMENTS_MANAGE: PERMISSIONS.PAYMENT_MANAGE_COMPANY.key,
        PAYMENTS_APPROVE: PERMISSIONS.PAYMENT_APPROVE_COMPANY.key,
        PURCHASE_ORDERS: PERMISSIONS.PROCUREMENT_VIEW.key,
        PURCHASE_ORDERS_MANAGE: PERMISSIONS.PROCUREMENT_MANAGE.key,
        PURCHASE_ORDERS_APPROVE: PERMISSIONS.PROCUREMENT_APPROVE.key,
    },
    ACCOUNTING: {
        DASHBOARD: PERMISSIONS.ACCOUNTING_VIEW.key,
        COA: PERMISSIONS.COA_VIEW.key,
        COA_MANAGE: PERMISSIONS.COA_MANAGE.key,
        JOURNAL_READ: PERMISSIONS.JOURNAL_VIEW.key,
        JOURNAL_WRITE: PERMISSIONS.JOURNAL_CREATE.key,
        JOURNAL_EDIT: PERMISSIONS.JOURNAL_EDIT.key,
        JOURNAL_APPROVE: PERMISSIONS.JOURNAL_APPROVE.key,
        LEDGER: PERMISSIONS.LEDGER_VIEW.key,
        PETTY_CASH: PERMISSIONS.CASH_VIEW.key,
        PETTY_CASH_MANAGE: PERMISSIONS.PETTY_CASH_MANAGE.key,
        VOUCHER: PERMISSIONS.VOUCHER_VIEW.key,
        VOUCHER_MANAGE: PERMISSIONS.VOUCHER_MANAGE.key,
        VOUCHER_APPROVE: PERMISSIONS.VOUCHER_APPROVE.key,
        BANKS: PERMISSIONS.BANK_VIEW.key,
        BANKS_MANAGE: PERMISSIONS.BANK_MANAGE.key,
        RECON: PERMISSIONS.RECONCILIATION_VIEW.key,
        RECON_APPROVE: PERMISSIONS.RECONCILIATION_APPROVE.key,
        PETTY_CASH_VIEW: PERMISSIONS.CASH_VIEW.key,
        INVESTORS_VIEW: PERMISSIONS.INVESTOR_VIEW.key,
        INVESTORS: PERMISSIONS.INVESTOR_MANAGE.key,
        LOANS_VIEW: PERMISSIONS.LOAN_VIEW.key,
        LOANS: PERMISSIONS.LOAN_MANAGE.key,
        PROFIT_DISTRIBUTION_VIEW: PERMISSIONS.PROFIT_DISTRIBUTION_VIEW.key,
        PROFIT_DISTRIBUTION: PERMISSIONS.PROFIT_DISTRIBUTION_MANAGE.key,
        REPORTS: PERMISSIONS.REPORT_VIEW.key,
        SETTINGS: PERMISSIONS.ACCOUNTING_MANAGE.key,
    },
    HR: {
        STAFF_READ: PERMISSIONS.HR_VIEW.key,
        STAFF_WRITE: PERMISSIONS.HR_MANAGE.key,
        ATTENDANCE_READ: PERMISSIONS.ATTENDANCE_VIEW.key,
        ATTENDANCE_MARK: PERMISSIONS.ATTENDANCE_MANAGE.key,
        PAYROLL_READ: PERMISSIONS.PAYROLL_VIEW.key,
        PAYROLL_MANAGE: PERMISSIONS.PAYROLL_MANAGE.key,
        PAYROLL_APPROVE: PERMISSIONS.PAYROLL_APPROVE.key,
        DESIGNATIONS: PERMISSIONS.HR_MANAGE.key,
        DEPARTMENTS: PERMISSIONS.HR_MANAGE.key,
    },
    POS: {
        ORDER_CREATE: PERMISSIONS.POS_CREATE.key,
        ORDER_READ: PERMISSIONS.POS_VIEW.key,
        ORDER_TAKER: PERMISSIONS.ORDERING_VIEW.key,
        ORDER_EDIT: PERMISSIONS.POS_EDIT.key,
        ORDER_CANCEL: PERMISSIONS.POS_APPROVE.key,
        ORDER_RETURN: PERMISSIONS.POS_APPROVE.key,
        SHIFT_MANAGE: PERMISSIONS.SHIFT_MANAGE.key,
        DAY_MANAGE: PERMISSIONS.DAY_MANAGE.key,
        TILL_MANAGE: PERMISSIONS.CASHIER_MANAGE.key,
        CASHIER_CONSOLE: PERMISSIONS.CASHIER_MANAGE.key,
        CREDIT_SETTLE: PERMISSIONS.CREDIT_ORDER_MANAGE.key,
        ORDER_SEARCH: PERMISSIONS.ORDER_SEARCH_VIEW.key,
        CREDIT_ORDERS: PERMISSIONS.CREDIT_ORDER_VIEW.key,
        CREDIT_ORDERS_MANAGE: PERMISSIONS.CREDIT_ORDER_MANAGE.key,
        BILL_VOID_VIEW: PERMISSIONS.BILL_VOID_VIEW.key,
        BILL_VOID_CREATE: PERMISSIONS.BILL_VOID_CREATE.key,
        BILL_VOID_APPROVE: PERMISSIONS.BILL_VOID_APPROVE.key,
        BILL_VOID_EXPORT: PERMISSIONS.BILL_VOID_EXPORT.key,
        BILL_VOID_MANAGE: PERMISSIONS.BILL_VOID_MANAGE.key,
        USER_HISTORY_VIEW: PERMISSIONS.USER_HISTORY_VIEW.key,
        USER_HISTORY_TRANSACTIONS: PERMISSIONS.USER_HISTORY_TRANSACTIONS.key,
        USER_HISTORY_AUDIT: PERMISSIONS.USER_HISTORY_AUDIT.key,
        USER_HISTORY_EXPORT: PERMISSIONS.USER_HISTORY_EXPORT.key,
        RECEIPTS_PRINT: PERMISSIONS.POS_VIEW.key,
        KDS_READ: PERMISSIONS.KDS_VIEW.key,
        KDS_MANAGE: PERMISSIONS.KDS_MANAGE.key,
        REPORTS: PERMISSIONS.REPORT_VIEW.key,
    },
    SEATING: {
        VIEW: PERMISSIONS.SEATING_VIEW.key,
        MANAGE: PERMISSIONS.SEATING_MANAGE.key,
    },
    SERVICE: {
        VIEW: PERMISSIONS.SERVICE_VIEW.key,
        MANAGE: PERMISSIONS.SERVICE_MANAGE.key,
    },
    CRM: {
        CUSTOMERS: PERMISSIONS.CUSTOMER_VIEW.key,
        CUSTOMERS_CREATE: PERMISSIONS.CUSTOMER_CREATE.key,
        CUSTOMERS_MANAGE: PERMISSIONS.CUSTOMER_MANAGE.key,
        DEALS: PERMISSIONS.DEAL_VIEW.key,
        DEALS_MANAGE: PERMISSIONS.DEAL_MANAGE.key,
        CATERING: PERMISSIONS.CATERING_VIEW.key,
        CATERING_MANAGE: PERMISSIONS.CATERING_MANAGE.key,
    },
    APPROVAL: {
        VIEW: PERMISSIONS.APPROVAL_VIEW.key,
        CREATE: PERMISSIONS.APPROVAL_CREATE.key,
        REVIEW: PERMISSIONS.APPROVAL_VIEW.key,
        APPROVE: PERMISSIONS.APPROVAL_APPROVE.key,
        REJECT: PERMISSIONS.APPROVAL_APPROVE.key,
        MANAGE: PERMISSIONS.APPROVAL_MANAGE.key,
    },
} as const;

const LEGACY_PERMISSION_ALIASES: Record<string, string> = {
    'platform.clients.manage': APP_PERMISSIONS.PLATFORM.CLIENT_MANAGE,
    'platform.users.manage': APP_PERMISSIONS.PLATFORM.USER_MANAGE,
    'platform.finance.manage': APP_PERMISSIONS.PLATFORM.FINANCE_MANAGE,
    'platform.support.read': APP_PERMISSIONS.PLATFORM.SUPPORT_READ,
    'platform.theme.manage': APP_PERMISSIONS.PLATFORM.THEME_MANAGE,
    'platform.audit.read': APP_PERMISSIONS.PLATFORM.AUDIT_READ,

    'admin.dashboard.read': APP_PERMISSIONS.ADMIN.DASHBOARD,
    'admin.analytics.read': APP_PERMISSIONS.ADMIN.ANALYTICS,
    'admin.setup.branches': APP_PERMISSIONS.ADMIN.SETUP_BRANCHES,
    'admin.setup.counters': APP_PERMISSIONS.ADMIN.SETUP_COUNTERS,
    'admin.setup.master': APP_PERMISSIONS.ADMIN.SETUP_MASTER,
    'admin.security.users': APP_PERMISSIONS.ADMIN.SECURITY_USERS,
    'admin.security.roles': APP_PERMISSIONS.ADMIN.SECURITY_ROLES,
    'admin.security.access': APP_PERMISSIONS.ADMIN.SECURITY_ACCESS,
    'admin.audit.read': APP_PERMISSIONS.ADMIN.AUDIT_READ,
    'admin.subscription.read': APP_PERMISSIONS.ADMIN.SUBSCRIPTION,
    'admin.setup.taxes': APP_PERMISSIONS.ADMIN.TAX_CONFIG,
    'admin.setup.payments': APP_PERMISSIONS.ADMIN.PAYMENT_METHODS,

    'catalog.read': APP_PERMISSIONS.CATALOG.READ,
    'catalog.write': APP_PERMISSIONS.CATALOG.WRITE,
    'catalog.delete': APP_PERMISSIONS.CATALOG.DELETE,
    'catalog.categories.manage': APP_PERMISSIONS.CATALOG.CATEGORIES,
    'catalog.architecture.manage': APP_PERMISSIONS.CATALOG.ARCHITECTURE,
    'catalog.recipes.read': APP_PERMISSIONS.CATALOG.RECIPE_READ,
    'catalog.recipes.write': APP_PERMISSIONS.CATALOG.RECIPE_WRITE,
    'catalog.items.write': APP_PERMISSIONS.CATALOG.WRITE,

    'inventory.dashboard.read': APP_PERMISSIONS.INVENTORY.DASHBOARD,
    'inventory.read': APP_PERMISSIONS.INVENTORY.READ,
    'inventory.stock.read': APP_PERMISSIONS.INVENTORY.READ,
    'inventory.setup.manage': APP_PERMISSIONS.INVENTORY.SETUP,
    'inventory.stock.adjust': APP_PERMISSIONS.INVENTORY.STOCK_ADJUST,
    'inventory.stock.receive': APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE,
    'inventory.stock.transfer': APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER,
    'inventory.adjust.branch': APP_PERMISSIONS.INVENTORY.STOCK_ADJUST,
    'inventory.receive.branch': APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE,
    'inventory.transfer.branch': APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER,
    'inventory.count.view': APP_PERMISSIONS.INVENTORY.COUNT_VIEW,
    'inventory.count.schedule': APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE,
    'inventory.count.perform': APP_PERMISSIONS.INVENTORY.COUNT_PERFORM,
    'inventory.count.review': APP_PERMISSIONS.INVENTORY.COUNT_REVIEW,
    'inventory.count.reconcile': APP_PERMISSIONS.INVENTORY.COUNT_RECONCILE,
    'inventory.count.report': APP_PERMISSIONS.INVENTORY.COUNT_REPORT,
    'inventory.count.settings': APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS,
    'inventory.location.manage': APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE,
    'inventory.month_close.manage': APP_PERMISSIONS.INVENTORY.MONTH_CLOSE,
    'inventory.count.view.branch': APP_PERMISSIONS.INVENTORY.COUNT_VIEW,
    'inventory.count.schedule.branch': APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE,
    'inventory.count.perform.branch': APP_PERMISSIONS.INVENTORY.COUNT_PERFORM,
    'inventory.count.review.branch': APP_PERMISSIONS.INVENTORY.COUNT_REVIEW,
    'inventory.count.reconcile.branch': APP_PERMISSIONS.INVENTORY.COUNT_RECONCILE,
    'inventory.count.report.branch': APP_PERMISSIONS.INVENTORY.COUNT_REPORT,
    'inventory.count.settings.company': APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS,
    'inventory.location.manage.company': APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE,
    'inventory.month_close.branch': APP_PERMISSIONS.INVENTORY.MONTH_CLOSE,
    'inventory.wastage.manage': PERMISSIONS.WASTAGE_MANAGE.key,
    'inventory.approvals.manage': APP_PERMISSIONS.APPROVAL.APPROVE,
    'inventory.assets.manage': APP_PERMISSIONS.INVENTORY.ASSETS,
    'inventory.ledger.read': APP_PERMISSIONS.INVENTORY.LEDGER,

    'procurement.vendors.manage': APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE,
    'procurement.payments.manage': APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE,
    'procurement.po.manage': APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE,

    'accounting.dashboard.read': APP_PERMISSIONS.ACCOUNTING.DASHBOARD,
    'accounting.coa.manage': APP_PERMISSIONS.ACCOUNTING.COA_MANAGE,
    'accounting.journal.read': APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
    'accounting.journal.write': APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    'accounting.ledger.read': APP_PERMISSIONS.ACCOUNTING.LEDGER,
    'accounting.petty_cash.manage': APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE,
    'accounting.voucher.manage': APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
    'accounting.banks.manage': APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE,
    'accounting.recon.manage': APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE,
    'bank.reconcile.company': APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE,
    'accounting.profit_distribution.manage': APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
    'accounting.investors.manage': APP_PERMISSIONS.ACCOUNTING.INVESTORS,
    'accounting.loans.manage': APP_PERMISSIONS.ACCOUNTING.LOANS,
    'accounting.reports.read': APP_PERMISSIONS.ACCOUNTING.REPORTS,
    'accounting.settings.manage': APP_PERMISSIONS.ACCOUNTING.SETTINGS,

    'hr.staff.read': APP_PERMISSIONS.HR.STAFF_READ,
    'hr.staff.write': APP_PERMISSIONS.HR.STAFF_WRITE,
    'hr.attendance.read': APP_PERMISSIONS.HR.ATTENDANCE_READ,
    'hr.attendance.mark': APP_PERMISSIONS.HR.ATTENDANCE_MARK,
    'hr.payroll.read': APP_PERMISSIONS.HR.PAYROLL_READ,
    'hr.payroll.manage': APP_PERMISSIONS.HR.PAYROLL_MANAGE,
    'hr.payroll.approve': APP_PERMISSIONS.HR.PAYROLL_APPROVE,
    'hr.designations.manage': APP_PERMISSIONS.HR.DESIGNATIONS,
    'hr.departments.manage': APP_PERMISSIONS.HR.DEPARTMENTS,

    'pos.order.create': APP_PERMISSIONS.POS.ORDER_CREATE,
    'pos.order.read': APP_PERMISSIONS.POS.ORDER_READ,
    'pos.order_taker.access': APP_PERMISSIONS.POS.ORDER_TAKER,
    'pos.order.cancel': APP_PERMISSIONS.POS.ORDER_CANCEL,
    'pos.order.return': APP_PERMISSIONS.POS.ORDER_RETURN,
    'pos.cancel.branch': APP_PERMISSIONS.POS.ORDER_CANCEL,
    'pos.return.branch': APP_PERMISSIONS.POS.ORDER_RETURN,
    'pos.shift.manage': APP_PERMISSIONS.POS.SHIFT_MANAGE,
    'pos.day.manage': APP_PERMISSIONS.POS.DAY_MANAGE,
    'pos.till.manage': APP_PERMISSIONS.POS.TILL_MANAGE,
    'pos.cashier.console': APP_PERMISSIONS.POS.CASHIER_CONSOLE,
    'pos.credit.settle': APP_PERMISSIONS.POS.CREDIT_SETTLE,
    'pos.order_search.read': APP_PERMISSIONS.POS.ORDER_SEARCH,
    'pos.credit_orders.manage': APP_PERMISSIONS.POS.CREDIT_ORDERS_MANAGE,
    'pos.bill_void.view': APP_PERMISSIONS.POS.BILL_VOID_VIEW,
    'pos.bill_void.create': APP_PERMISSIONS.POS.BILL_VOID_CREATE,
    'pos.bill_void.approve': APP_PERMISSIONS.POS.BILL_VOID_APPROVE,
    'pos.bill_void.export': APP_PERMISSIONS.POS.BILL_VOID_EXPORT,
    'pos.bill_void.manage': APP_PERMISSIONS.POS.BILL_VOID_MANAGE,
    'pos.user_history.view': APP_PERMISSIONS.POS.USER_HISTORY_VIEW,
    'pos.user_history.transactions': APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS,
    'pos.user_history.audit': APP_PERMISSIONS.POS.USER_HISTORY_AUDIT,
    'pos.user_history.export': APP_PERMISSIONS.POS.USER_HISTORY_EXPORT,
    'pos.receipts.print': APP_PERMISSIONS.POS.RECEIPTS_PRINT,
    'pos.kds.read': APP_PERMISSIONS.POS.KDS_READ,
    'pos.reports.read': APP_PERMISSIONS.POS.REPORTS,

    'crm.customers.manage': APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
    'crm.deals.manage': APP_PERMISSIONS.CRM.DEALS_MANAGE,
    'crm.catering.manage': APP_PERMISSIONS.CRM.CATERING_MANAGE,
    'approval.review.branch': APP_PERMISSIONS.APPROVAL.REVIEW,
    'approval.reject.branch': APP_PERMISSIONS.APPROVAL.REJECT,
};

export function normalizePermissionKey(permission?: string | null): string {
    const normalized = String(permission || '').trim().toLowerCase();
    if (!normalized || normalized === 'all') {
        return normalized;
    }
    return LEGACY_PERMISSION_ALIASES[normalized] ?? normalized;
}

export function parsePermissionKey(permission?: string | null) {
    const normalized = normalizePermissionKey(permission);
    const [module = '', action = '', scope = 'branch'] = normalized.split('.');
    return { module, action, scope };
}

export interface UserContextBranch {
    id?: number;
    branch_id: number;
    branch_name: string | null;
    currency_code?: string | null;
    effective_currency_code?: string | null;
    inherit_client_currency?: boolean;
    date_format?: string | null;
    time_format?: string | null;
    inventory_store_type?: 'branch' | 'central';
    role_id: number | null;
    role_name: string | null;
    is_primary: boolean;
    assignment_scope?: 'branch' | 'central';
    approval_authority?: 'none' | 'branch' | 'central' | 'both' | null;
    role_context_scope?: 'branch' | 'central' | 'hybrid';
    role_approval_authority?: 'none' | 'branch' | 'central' | 'both' | null;
    effective_permissions?: string[];
    allowed_modules?: string[];
}

export interface UserContext {
    sub?: string | number;
    username?: string;
    user_name?: string;
    email?: string;
    client_id?: string;
    client_name?: string;
    client_currency?: string | null;
    short_name?: string;
    role?: string | number;
    user_type?: string;
    is_system?: boolean;
    branch_id?: number;
    active_branch_id?: number;
    effective_permissions?: string[];
    allowed_modules?: string[];
    allowed_branches?: UserContextBranch[];
    organization_user_type?: string;
    tenant_slug?: string | null;
    domain_slug?: string | null;
}

function normalizeClientId(value?: string | null): string | undefined {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) {
        return undefined;
    }

    if (/^CL-\d+$/.test(normalized)) {
        return normalized.replace('-', '');
    }

    return normalized;
}

export function readStoredUserContext(): UserContext | null {
    try {
        const raw = readAuthSessionItem('user_context');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as UserContext;
        const normalizedClientId = normalizeClientId(parsed.client_id);
        if (normalizedClientId && normalizedClientId !== parsed.client_id) {
            const normalized = { ...parsed, client_id: normalizedClientId };
            setAuthSessionItem('user_context', JSON.stringify(normalized));
            localStorage.setItem('client_id', normalizedClientId);
            return normalized;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function persistUserContext(userContext: UserContext): void {
    const normalizedUserContext = {
        ...userContext,
        client_id: normalizeClientId(userContext.client_id) ?? userContext.client_id,
    };

    setAuthSessionItem('user_context', JSON.stringify(normalizedUserContext));
    if (normalizedUserContext.client_id) {
        localStorage.setItem('client_id', String(normalizedUserContext.client_id));
    }

    const resolvedBranchId = normalizedUserContext.active_branch_id ?? resolvePrimaryBranchId(normalizedUserContext);
    if (resolvedBranchId) {
        localStorage.setItem('activeBranchId', String(resolvedBranchId));
        localStorage.setItem('branch_id', String(resolvedBranchId));
    }

    window.dispatchEvent(new CustomEvent(USER_CONTEXT_CHANGED_EVENT, { detail: normalizedUserContext }));
}

export function resolvePrimaryBranchId(userContext?: UserContext | null): number | null {
    const branches = userContext?.allowed_branches ?? [];
    const primary = branches.find((branch) => branch.is_primary) ?? branches[0];
    return primary?.branch_id ? Number(primary.branch_id) : null;
}

export function resolveTenantSlug(userContext?: UserContext | null): string | null {
    const normalized = String(userContext?.tenant_slug || userContext?.domain_slug || '').trim().toLowerCase();
    return normalized || null;
}
