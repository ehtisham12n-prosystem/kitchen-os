type PermissionScope = 'company' | 'branch' | 'own';

type PermissionRecord = {
  key: string;
  module: string;
  action: string;
  scope: PermissionScope;
  label: string;
};

type PermissionGroupRecord = {
  key: string;
  label: string;
  description: string;
  recommended_roles: string[];
  permission_count: number;
  permissions: Array<{ id: string; label: string }>;
};

function definePermission(
  module: string,
  action: string,
  scope: PermissionScope,
  label: string,
): PermissionRecord {
  return {
    key: `${module}.${action}.${scope}`,
    module,
    action,
    scope,
    label,
  };
}

const PERMISSIONS = {
  PLATFORM_VIEW: definePermission('platform', 'view', 'company', 'View platform workspace'),
  PLATFORM_MANAGE: definePermission('platform', 'manage', 'company', 'Manage platform workspace'),
  CLIENT_VIEW: definePermission('client', 'view', 'company', 'View clients'),
  CLIENT_MANAGE: definePermission('client', 'manage', 'company', 'Manage clients'),
  USER_VIEW: definePermission('user', 'view', 'company', 'View users'),
  USER_MANAGE: definePermission('user', 'manage', 'company', 'Manage users'),
  ROLE_VIEW: definePermission('role', 'view', 'company', 'View roles'),
  ROLE_MANAGE: definePermission('role', 'manage', 'company', 'Manage roles'),
  PERMISSION_VIEW: definePermission('permission', 'view', 'company', 'View permission registry'),
  PERMISSION_MANAGE: definePermission('permission', 'manage', 'company', 'Manage permission registry'),
  AUDIT_VIEW: definePermission('audit', 'view', 'company', 'View audit logs'),
  SUPPORT_VIEW: definePermission('support', 'view', 'company', 'View support workspace'),
  SUPPORT_MANAGE: definePermission('support', 'manage', 'company', 'Manage support workspace'),
  THEME_VIEW: definePermission('theme', 'view', 'company', 'View themes'),
  THEME_MANAGE: definePermission('theme', 'manage', 'company', 'Manage themes'),
  SUBSCRIPTION_VIEW: definePermission('subscription', 'view', 'company', 'View subscriptions'),
  SUBSCRIPTION_MANAGE: definePermission('subscription', 'manage', 'company', 'Manage subscriptions'),
  BRANCH_VIEW: definePermission('branch', 'view', 'company', 'View branches'),
  BRANCH_MANAGE: definePermission('branch', 'manage', 'company', 'Manage branches'),
  COUNTER_VIEW: definePermission('counter', 'view', 'company', 'View counters'),
  COUNTER_MANAGE: definePermission('counter', 'manage', 'company', 'Manage counters'),
  SETTINGS_VIEW: definePermission('settings', 'view', 'company', 'View company settings'),
  SETTINGS_MANAGE: definePermission('settings', 'manage', 'company', 'Manage company settings'),
  TAX_VIEW: definePermission('tax', 'view', 'company', 'View taxes'),
  TAX_MANAGE: definePermission('tax', 'manage', 'company', 'Manage taxes'),
  ANALYTICS_VIEW_COMPANY: definePermission('analytics', 'view', 'company', 'View company analytics'),
  ANALYTICS_VIEW_BRANCH: definePermission('analytics', 'view', 'branch', 'View branch analytics'),
  DASHBOARD_VIEW_COMPANY: definePermission('dashboard', 'view', 'company', 'View company dashboard'),
  DASHBOARD_VIEW_BRANCH: definePermission('dashboard', 'view', 'branch', 'View branch dashboard'),
  CATALOG_VIEW: definePermission('catalog', 'view', 'company', 'View catalog'),
  CATALOG_CREATE: definePermission('catalog', 'create', 'company', 'Create catalog entries'),
  CATALOG_EDIT: definePermission('catalog', 'edit', 'company', 'Edit catalog entries'),
  CATALOG_DELETE: definePermission('catalog', 'delete', 'company', 'Delete catalog entries'),
  CATALOG_MANAGE: definePermission('catalog', 'manage', 'company', 'Manage catalog'),
  RECIPE_VIEW: definePermission('recipe', 'view', 'company', 'View recipes'),
  RECIPE_CREATE: definePermission('recipe', 'create', 'company', 'Create recipes'),
  RECIPE_EDIT: definePermission('recipe', 'edit', 'company', 'Edit recipes'),
  RECIPE_DELETE: definePermission('recipe', 'delete', 'company', 'Delete recipes'),
  RECIPE_MANAGE: definePermission('recipe', 'manage', 'company', 'Manage recipes'),
  INVENTORY_VIEW: definePermission('inventory', 'view', 'branch', 'View inventory'),
  INVENTORY_CREATE: definePermission('inventory', 'create', 'branch', 'Create stock transactions'),
  INVENTORY_EDIT: definePermission('inventory', 'edit', 'branch', 'Edit stock transactions'),
  INVENTORY_APPROVE: definePermission('inventory', 'approve', 'branch', 'Approve stock controls'),
  INVENTORY_MANAGE: definePermission('inventory', 'manage', 'company', 'Manage inventory setup'),
  INVENTORY_COUNT_VIEW: definePermission('inventory_count', 'view', 'branch', 'View blind count sessions'),
  INVENTORY_COUNT_SCHEDULE: definePermission('inventory_count', 'schedule', 'branch', 'Schedule blind count sessions'),
  INVENTORY_COUNT_PERFORM: definePermission('inventory_count', 'perform', 'branch', 'Perform blind stock counts'),
  INVENTORY_COUNT_REVIEW: definePermission('inventory_count', 'review', 'branch', 'Review blind count discrepancies'),
  INVENTORY_COUNT_RECONCILE: definePermission('inventory_count', 'reconcile', 'branch', 'Reconcile blind count variances'),
  INVENTORY_COUNT_REPORT: definePermission('inventory_count', 'report', 'branch', 'View blind count dashboards and reports'),
  INVENTORY_COUNT_SETTINGS: definePermission('inventory_count', 'settings', 'company', 'Manage blind count settings'),
  INVENTORY_LOCATION_MANAGE: definePermission('inventory_location', 'manage', 'company', 'Manage branch inventory locations'),
  INVENTORY_MONTH_CLOSE: definePermission('inventory_count', 'month_close', 'branch', 'Manage monthly blind stock close'),
  WASTAGE_VIEW: definePermission('wastage', 'view', 'branch', 'View wastage'),
  WASTAGE_CREATE: definePermission('wastage', 'create', 'branch', 'Create wastage entries'),
  WASTAGE_APPROVE: definePermission('wastage', 'approve', 'branch', 'Approve wastage entries'),
  WASTAGE_MANAGE: definePermission('wastage', 'manage', 'branch', 'Manage wastage'),
  ASSET_VIEW: definePermission('asset', 'view', 'branch', 'View assets'),
  ASSET_CREATE: definePermission('asset', 'create', 'branch', 'Create assets'),
  ASSET_EDIT: definePermission('asset', 'edit', 'branch', 'Edit assets'),
  ASSET_DELETE: definePermission('asset', 'delete', 'branch', 'Delete assets'),
  ASSET_MANAGE: definePermission('asset', 'manage', 'branch', 'Manage assets'),
  LEDGER_VIEW: definePermission('ledger', 'view', 'branch', 'View inventory ledger'),
  VENDOR_VIEW: definePermission('vendor', 'view', 'company', 'View vendors'),
  VENDOR_CREATE: definePermission('vendor', 'create', 'company', 'Create vendors'),
  VENDOR_EDIT: definePermission('vendor', 'edit', 'company', 'Edit vendors'),
  VENDOR_DELETE: definePermission('vendor', 'delete', 'company', 'Delete vendors'),
  VENDOR_MANAGE: definePermission('vendor', 'manage', 'company', 'Manage vendors'),
  PROCUREMENT_VIEW: definePermission('procurement', 'view', 'branch', 'View procurement'),
  PROCUREMENT_CREATE: definePermission('procurement', 'create', 'branch', 'Create procurement requests'),
  PROCUREMENT_EDIT: definePermission('procurement', 'edit', 'branch', 'Edit procurement requests'),
  PROCUREMENT_DELETE: definePermission('procurement', 'delete', 'branch', 'Delete procurement requests'),
  PROCUREMENT_APPROVE: definePermission('procurement', 'approve', 'branch', 'Approve procurement requests'),
  PROCUREMENT_MANAGE: definePermission('procurement', 'manage', 'branch', 'Manage procurement'),
  PAYMENT_VIEW_COMPANY: definePermission('payment', 'view', 'company', 'View payments'),
  PAYMENT_MANAGE_COMPANY: definePermission('payment', 'manage', 'company', 'Manage payments'),
  PAYMENT_APPROVE_COMPANY: definePermission('payment', 'approve', 'company', 'Approve payments'),
  ACCOUNTING_VIEW: definePermission('accounting', 'view', 'company', 'View accounting dashboard'),
  ACCOUNTING_MANAGE: definePermission('accounting', 'manage', 'company', 'Manage accounting setup'),
  JOURNAL_VIEW: definePermission('journal', 'view', 'company', 'View journals'),
  JOURNAL_CREATE: definePermission('journal', 'create', 'branch', 'Create journals'),
  JOURNAL_EDIT: definePermission('journal', 'edit', 'branch', 'Edit journals'),
  JOURNAL_APPROVE: definePermission('journal', 'approve', 'company', 'Approve journals'),
  COA_VIEW: definePermission('coa', 'view', 'company', 'View chart of accounts'),
  COA_MANAGE: definePermission('coa', 'manage', 'company', 'Manage chart of accounts'),
  CASH_VIEW: definePermission('cash', 'view', 'branch', 'View petty cash and tills'),
  PETTY_CASH_MANAGE: definePermission('cash', 'manage', 'branch', 'Manage petty cash and tills'),
  VOUCHER_VIEW: definePermission('voucher', 'view', 'branch', 'View vouchers'),
  VOUCHER_MANAGE: definePermission('voucher', 'manage', 'branch', 'Manage vouchers'),
  VOUCHER_APPROVE: definePermission('voucher', 'approve', 'branch', 'Approve vouchers'),
  BANK_VIEW: definePermission('bank', 'view', 'company', 'View bank accounts'),
  BANK_MANAGE: definePermission('bank', 'manage', 'company', 'Manage bank accounts'),
  RECONCILIATION_VIEW: definePermission('reconciliation', 'view', 'company', 'View reconciliations'),
  RECONCILIATION_APPROVE: definePermission('reconciliation', 'approve', 'company', 'Approve reconciliations'),
  INVESTOR_VIEW: definePermission('investor', 'view', 'company', 'View investors'),
  INVESTOR_MANAGE: definePermission('investor', 'manage', 'company', 'Manage investors'),
  LOAN_VIEW: definePermission('loan', 'view', 'company', 'View loans'),
  LOAN_MANAGE: definePermission('loan', 'manage', 'company', 'Manage loans'),
  PROFIT_DISTRIBUTION_VIEW: definePermission('profit_distribution', 'view', 'company', 'View profit distributions'),
  PROFIT_DISTRIBUTION_MANAGE: definePermission('profit_distribution', 'manage', 'company', 'Manage profit distributions'),
  REPORT_VIEW: definePermission('report', 'view', 'branch', 'View reports'),
  HR_VIEW: definePermission('hr', 'view', 'branch', 'View staff records'),
  HR_MANAGE: definePermission('hr', 'manage', 'company', 'Manage staff records'),
  ATTENDANCE_VIEW: definePermission('attendance', 'view', 'branch', 'View attendance'),
  ATTENDANCE_MANAGE: definePermission('attendance', 'manage', 'branch', 'Manage attendance'),
  PAYROLL_VIEW: definePermission('payroll', 'view', 'branch', 'View payroll runs'),
  PAYROLL_MANAGE: definePermission('payroll', 'manage', 'branch', 'Manage payroll runs'),
  PAYROLL_APPROVE: definePermission('payroll', 'approve', 'branch', 'Approve payroll runs'),
  POS_VIEW: definePermission('pos', 'view', 'branch', 'View POS'),
  POS_CREATE: definePermission('pos', 'create', 'branch', 'Create POS orders'),
  POS_EDIT: definePermission('pos', 'edit', 'branch', 'Edit POS orders'),
  POS_APPROVE: definePermission('pos', 'approve', 'branch', 'Approve POS exceptions'),
  POS_MANAGE: definePermission('pos', 'manage', 'branch', 'Manage POS'),
  SHIFT_VIEW: definePermission('shift', 'view', 'branch', 'View shifts'),
  SHIFT_MANAGE: definePermission('shift', 'manage', 'branch', 'Manage shifts'),
  DAY_VIEW: definePermission('day', 'view', 'branch', 'View business day'),
  DAY_MANAGE: definePermission('day', 'manage', 'branch', 'Manage business day'),
  CASHIER_VIEW: definePermission('cashier', 'view', 'branch', 'View cashier console'),
  CASHIER_MANAGE: definePermission('cashier', 'manage', 'branch', 'Manage cashier console'),
  ORDER_SEARCH_VIEW: definePermission('order_search', 'view', 'branch', 'Search and inspect branch orders'),
  CREDIT_ORDER_VIEW: definePermission('credit_order', 'view', 'branch', 'View credit orders and settlements'),
  CREDIT_ORDER_MANAGE: definePermission('credit_order', 'manage', 'branch', 'Manage credit orders and settlements'),
  BILL_VOID_VIEW: definePermission('bill_void', 'view', 'branch', 'View Void Bills'),
  BILL_VOID_CREATE: definePermission('bill_void', 'create', 'branch', 'Create/Void Bill'),
  BILL_VOID_APPROVE: definePermission('bill_void', 'approve', 'branch', 'Approve Void Bill'),
  BILL_VOID_EXPORT: definePermission('bill_void', 'export', 'branch', 'Export Void Reports'),
  BILL_VOID_MANAGE: definePermission('bill_void', 'manage', 'branch', 'Manage Void Settings'),
  USER_HISTORY_VIEW: definePermission('user_history', 'view', 'branch', 'View User History'),
  USER_HISTORY_TRANSACTIONS: definePermission('user_history', 'transactions', 'branch', 'View Transactions'),
  USER_HISTORY_AUDIT: definePermission('user_history', 'audit', 'branch', 'View Audit Logs'),
  USER_HISTORY_EXPORT: definePermission('user_history', 'export', 'branch', 'Export Data'),
  KDS_VIEW: definePermission('kds', 'view', 'branch', 'View kitchen display'),
  KDS_MANAGE: definePermission('kds', 'manage', 'branch', 'Manage kitchen display workflows'),
  ORDERING_VIEW: definePermission('ordering', 'view', 'branch', 'View order taker workspace'),
  SEATING_VIEW: definePermission('seating', 'view', 'branch', 'View seating, floors, tables, and QR setup'),
  SEATING_MANAGE: definePermission('seating', 'manage', 'branch', 'Manage seating, floors, tables, and QR setup'),
  SERVICE_VIEW: definePermission('service', 'view', 'branch', 'View service area assignments'),
  SERVICE_MANAGE: definePermission('service', 'manage', 'branch', 'Manage service area assignments'),
  CUSTOMER_VIEW: definePermission('customer', 'view', 'branch', 'View customers'),
  CUSTOMER_CREATE: definePermission('customer', 'create', 'branch', 'Create customers'),
  CUSTOMER_EDIT: definePermission('customer', 'edit', 'branch', 'Edit customers'),
  CUSTOMER_DELETE: definePermission('customer', 'delete', 'branch', 'Delete customers'),
  CUSTOMER_MANAGE: definePermission('customer', 'manage', 'branch', 'Manage customers'),
  DEAL_VIEW: definePermission('deal', 'view', 'branch', 'View deals'),
  DEAL_MANAGE: definePermission('deal', 'manage', 'branch', 'Manage deals'),
  CATERING_VIEW: definePermission('catering', 'view', 'branch', 'View catering'),
  CATERING_MANAGE: definePermission('catering', 'manage', 'branch', 'Manage catering'),
  APPROVAL_VIEW: definePermission('approval', 'view', 'branch', 'View approval inbox'),
  APPROVAL_CREATE: definePermission('approval', 'create', 'branch', 'Create approval requests'),
  APPROVAL_APPROVE: definePermission('approval', 'approve', 'branch', 'Approve or reject requests'),
  APPROVAL_MANAGE: definePermission('approval', 'manage', 'branch', 'Manage approval workflows'),
} as const;

export const SYSTEM_PERMISSION_REGISTRY: PermissionRecord[] = Object.values(PERMISSIONS);

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
    INVESTORS: PERMISSIONS.INVESTOR_MANAGE.key,
    INVESTORS_VIEW: PERMISSIONS.INVESTOR_VIEW.key,
    LOANS: PERMISSIONS.LOAN_MANAGE.key,
    LOANS_VIEW: PERMISSIONS.LOAN_VIEW.key,
    PROFIT_DISTRIBUTION: PERMISSIONS.PROFIT_DISTRIBUTION_MANAGE.key,
    PROFIT_DISTRIBUTION_VIEW: PERMISSIONS.PROFIT_DISTRIBUTION_VIEW.key,
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

export function normalizePermissionKey(permission: string): string {
  const normalized = String(permission || '').trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return normalized;
  }
  return LEGACY_PERMISSION_ALIASES[normalized] ?? normalized;
}

export function parsePermissionKey(permission: string) {
  const normalized = normalizePermissionKey(permission);
  const [module = '', action = '', scope = 'branch'] = normalized.split('.');
  return { module, action, scope };
}

function humanizeToken(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function formatPermissionLabel(record: PermissionRecord): string {
  return `${humanizeToken(record.module)}: ${humanizeToken(record.action)} ${record.scope}`;
}

const MODULE_METADATA: Record<string, { description: string; recommended_roles: string[] }> = {
  analytics: {
    description: 'Company and branch performance visibility for leadership and management roles.',
    recommended_roles: ['Owner', 'Area Manager / GM', 'Branch Manager'],
  },
  approval: {
    description: 'Exception, discount, wastage, voucher, and procurement approval workflows.',
    recommended_roles: ['Owner', 'Area Manager / GM', 'Branch Manager', 'Finance Manager'],
  },
  asset: {
    description: 'Branch asset issue, transfer, and disposal controls.',
    recommended_roles: ['Inventory Manager', 'Accountant', 'Finance Manager'],
  },
  attendance: {
    description: 'Shift attendance capture and attendance governance for staff operations.',
    recommended_roles: ['HR Manager', 'Branch Manager', 'Supervisor'],
  },
  audit: {
    description: 'Audit trail review for compliance and internal control workflows.',
    recommended_roles: ['Owner', 'Auditor', 'Client Admin'],
  },
  bank: {
    description: 'Bank master setup and reconciliation controls.',
    recommended_roles: ['Accountant', 'Finance Manager'],
  },
  branch: {
    description: 'Branch creation, branch structure, and outlet governance.',
    recommended_roles: ['Client Admin', 'Group Admin'],
  },
  cash: {
    description: 'Petty cash and branch cash control operations.',
    recommended_roles: ['Accountant', 'Finance Manager', 'Branch Manager'],
  },
  catering: {
    description: 'Catering opportunity and event-order workflows.',
    recommended_roles: ['Branch Manager', 'Sales Coordinator'],
  },
  catalog: {
    description: 'Item master, categories, pricing structure, and menu architecture.',
    recommended_roles: ['Client Admin', 'Inventory Manager'],
  },
  client: {
    description: 'Tenant administration across the company workspace.',
    recommended_roles: ['Platform Super Admin'],
  },
  coa: {
    description: 'Chart of accounts governance and accounting structure.',
    recommended_roles: ['Accountant', 'Finance Manager', 'Group Admin'],
  },
  counter: {
    description: 'POS counter and till-point structure management.',
    recommended_roles: ['Client Admin', 'Branch Manager'],
  },
  credit_order: {
    description: 'Credit billing, settlement, and follow-up operations.',
    recommended_roles: ['Cashier', 'Branch Manager', 'Supervisor'],
  },
  customer: {
    description: 'Guest profiles, lookup, and customer data control.',
    recommended_roles: ['Cashier', 'Order Taker', 'Branch Manager'],
  },
  dashboard: {
    description: 'Operational and management dashboard entry points.',
    recommended_roles: ['Owner', 'Client Admin', 'Area Manager / GM', 'Branch Manager'],
  },
  deal: {
    description: 'Promotions, deals, and commercial offer control.',
    recommended_roles: ['Branch Manager', 'Marketing Lead'],
  },
  hr: {
    description: 'Employee records, structure, and staff administration.',
    recommended_roles: ['HR Manager', 'Client Admin'],
  },
  inventory: {
    description: 'Stock visibility, adjustment, receiving, and transfer workflows.',
    recommended_roles: ['Inventory Manager', 'Storekeeper', 'Branch Manager'],
  },
  inventory_count: {
    description: 'Blind count execution, variance review, closing dashboards, and monthly stock verification.',
    recommended_roles: ['Inventory Manager', 'Store Manager', 'Branch Manager', 'Owner', 'Auditor'],
  },
  inventory_location: {
    description: 'Branch stock area and in-store location master data management.',
    recommended_roles: ['Client Admin', 'Group Admin', 'Inventory Manager'],
  },
  investor: {
    description: 'Investor records and capital relationship visibility.',
    recommended_roles: ['Owner', 'Finance Manager'],
  },
  journal: {
    description: 'Journal posting and accounting transaction capture.',
    recommended_roles: ['Accountant', 'Finance Manager'],
  },
  kds: {
    description: 'Kitchen display execution and production flow management.',
    recommended_roles: ['Kitchen Lead', 'Head Chef', 'Branch Manager'],
  },
  ledger: {
    description: 'Stock and accounting ledger review for reconciliation and control.',
    recommended_roles: ['Accountant', 'Auditor', 'Inventory Manager'],
  },
  loan: {
    description: 'Loan tracking, repayment, and liability visibility.',
    recommended_roles: ['Owner', 'Finance Manager'],
  },
  ordering: {
    description: 'Mobile order-taking workspace for floor staff.',
    recommended_roles: ['Order Taker'],
  },
  order_search: {
    description: 'Order lookup, inspection, and recovery desk workflows.',
    recommended_roles: ['Cashier', 'Supervisor', 'Branch Manager'],
  },
  payment: {
    description: 'Payment method governance and vendor payment control.',
    recommended_roles: ['Finance Manager', 'Procurement Manager', 'Client Admin'],
  },
  permission: {
    description: 'Permission registry governance for access-control administrators.',
    recommended_roles: ['Client Admin', 'Group Admin'],
  },
  platform: {
    description: 'Platform-only system administration and workspace control.',
    recommended_roles: ['Platform Super Admin'],
  },
  payroll: {
    description: 'Payroll run preparation, approval, payment, and labor-cost review.',
    recommended_roles: ['HR Manager', 'Finance Manager', 'Accountant'],
  },
  pos: {
    description: 'Order capture, cashier execution, and POS transactional workflows.',
    recommended_roles: ['Cashier', 'Order Taker', 'Supervisor', 'Branch Manager'],
  },
  procurement: {
    description: 'Purchase order lifecycle and procurement workflow controls.',
    recommended_roles: ['Procurement Manager', 'Inventory Manager', 'Branch Manager'],
  },
  profit_distribution: {
    description: 'Profit allocation and distribution governance.',
    recommended_roles: ['Owner', 'Finance Manager'],
  },
  recipe: {
    description: 'Recipe definitions, costing, and production standards.',
    recommended_roles: ['Inventory Manager', 'Kitchen Lead'],
  },
  reconciliation: {
    description: 'Bank and book reconciliation review and approval workflows.',
    recommended_roles: ['Accountant', 'Finance Manager'],
  },
  report: {
    description: 'Operational, financial, and performance report access.',
    recommended_roles: ['Owner', 'Finance Manager', 'Branch Manager', 'Auditor'],
  },
  user_history: {
    description: 'User-wise order, transaction, and audit history controls.',
    recommended_roles: ['Owner', 'General Manager', 'Branch Manager', 'Finance Manager', 'Auditor'],
  },
  role: {
    description: 'Role template creation and access-profile governance.',
    recommended_roles: ['Client Admin', 'Group Admin'],
  },
  seating: {
    description: 'Floors, tables, QR codes, and seating layout management.',
    recommended_roles: ['Seating Host', 'Branch Manager', 'Supervisor'],
  },
  service: {
    description: 'Service area ownership and floor assignment workflows.',
    recommended_roles: ['Seating Host', 'Supervisor', 'Branch Manager'],
  },
  settings: {
    description: 'Master setup, branding, company-level configuration, and accounting close governance.',
    recommended_roles: ['Client Admin', 'Group Admin', 'Finance Manager'],
  },
  shift: {
    description: 'Shift planning, opening, and operating session governance.',
    recommended_roles: ['Cashier', 'Supervisor', 'Branch Manager'],
  },
  subscription: {
    description: 'Plan, entitlement, and subscription visibility.',
    recommended_roles: ['Client Admin', 'Owner'],
  },
  support: {
    description: 'Support workspace visibility for managed service and platform teams.',
    recommended_roles: ['Platform Super Admin'],
  },
  tax: {
    description: 'Tax code setup and default tax governance.',
    recommended_roles: ['Client Admin', 'Finance Manager'],
  },
  theme: {
    description: 'Branding and theme management for multi-tenant deployments.',
    recommended_roles: ['Platform Super Admin'],
  },
  user: {
    description: 'User directory and access assignment governance.',
    recommended_roles: ['Client Admin', 'Group Admin', 'HR Manager'],
  },
  vendor: {
    description: 'Vendor master records and supplier management.',
    recommended_roles: ['Procurement Manager', 'Inventory Manager'],
  },
  voucher: {
    description: 'Voucher issuance, posting, and financial approval operations.',
    recommended_roles: ['Accountant', 'Finance Manager'],
  },
  wastage: {
    description: 'Wastage capture, review, and disposal control.',
    recommended_roles: ['Inventory Manager', 'Storekeeper', 'Branch Manager'],
  },
};

export const PERMISSION_GROUPS: PermissionGroupRecord[] = Object.values(
  SYSTEM_PERMISSION_REGISTRY.reduce<Record<string, PermissionGroupRecord>>(
    (groups, record) => {
      const key = record.module;
      if (!groups[key]) {
        const metadata = MODULE_METADATA[key] ?? {
          description: `${humanizeToken(record.module)} access controls and actions.`,
          recommended_roles: [],
        };
        groups[key] = {
          key,
          label: humanizeToken(record.module),
          description: metadata.description,
          recommended_roles: metadata.recommended_roles,
          permission_count: 0,
          permissions: [],
        };
      }

      groups[key].permissions.push({
        id: record.key,
        label: formatPermissionLabel(record),
      });
      groups[key].permission_count += 1;

      return groups;
    },
    {},
  ),
).sort((left, right) => left.label.localeCompare(right.label));
