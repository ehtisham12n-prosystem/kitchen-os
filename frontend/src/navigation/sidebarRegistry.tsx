import type { ReactNode } from 'react';
import {
    ArrowDownToLine,
    ArrowLeftRight,
    BarChart2,
    BarChart3,
    BookOpen,
    Boxes,
    Briefcase,
    Building2,
    Calculator,
    CheckCircle2,
    ChefHat,
    ClipboardList,
    CreditCard,
    Crown,
    Database,
    FileText,
    FolderTree,
    GitCompareArrows,
    Globe,
    HandCoins,
    Landmark,
    Layers,
    LayoutDashboard,
    LayoutGrid,
    LifeBuoy,
    Megaphone,
    Monitor,
    Package,
    Palette,
    PiggyBank,
    QrCode,
    Receipt,
    RotateCcw,
    Ruler,
    Scale,
    Search,
    Settings,
    Settings2,
    ShieldCheck,
    Store,
    Sun,
    Tag,
    ToggleLeft,
    TrendingDown,
    TrendingUp,
    Truck,
    UserCheck,
    Users,
    Utensils,
    Wallet,
    Warehouse,
} from 'lucide-react';
import { APP_PERMISSIONS } from '../auth/access';

export type SidebarItemDefinition = {
    key: string;
    label: string;
    to: string;
    icon: ReactNode;
    anyOf?: string[];
    allOf?: string[];
    moduleKeys?: string[];
    external?: boolean;
};

export type SidebarSectionDefinition = {
    id: string;
    label: string;
    items: SidebarItemDefinition[];
};

export type SidebarWorkspaceDefinition = {
    title: string;
    subtitle: string;
    icon: ReactNode;
    sections: SidebarSectionDefinition[];
};

function withConsoleBase(consoleBase: string, path: string) {
    return path.replaceAll('{consoleBase}', consoleBase);
}

export function resolveSidebarPath(consoleBase: string, path: string) {
    return path.startsWith('{consoleBase}') ? withConsoleBase(consoleBase, path) : path;
}

export const SYSTEM_SIDEBAR: SidebarWorkspaceDefinition = {
    title: 'Platform Governance',
    subtitle: 'Nexus controls, tenant supervision, and platform security',
    icon: <Crown size={13} />,
    sections: [
        {
            id: 'nexus_gov',
            label: 'Platform Governance',
            items: [
                { key: 'nexus-dashboard', label: 'Platform Dashboard', to: '/nexus', icon: <LayoutDashboard size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-radar', label: 'Attention Radar', to: '/nexus/radar', icon: <TrendingUp size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-support', label: 'Support Workspace', to: '/nexus/support', icon: <LifeBuoy size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPPORT_READ, APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-subscriptions', label: 'Subscription Plans', to: '/nexus/subscription_pack', icon: <Package size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-features', label: 'Feature Registry', to: '/nexus/features', icon: <ToggleLeft size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-blueprints', label: 'Blueprints', to: '/nexus/blueprints', icon: <Layers size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-onboarding', label: 'Onboarding Queue', to: '/nexus/onboarding', icon: <CheckCircle2 size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-invoices', label: 'Client Invoices', to: '/nexus/invoices', icon: <FileText size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-broadcasts', label: 'Global Broadcasts', to: '/nexus/broadcasts', icon: <Megaphone size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-users', label: 'System Users', to: '/nexus/users', icon: <Users size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.USER_MANAGE, APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-themes', label: 'Theme Engine', to: '/nexus/themes', icon: <Palette size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.THEME_MANAGE, APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
            ],
        },
        {
            id: 'nexus_global',
            label: 'Global Configuration',
            items: [
                { key: 'nexus-clients', label: 'Client Management', to: '/nexus/clients', icon: <ShieldCheck size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.CLIENT_MANAGE, APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-departments', label: 'Departments', to: '/nexus/departments', icon: <Building2 size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-designations', label: 'Designations', to: '/nexus/designations', icon: <Briefcase size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
            ],
        },
        {
            id: 'nexus_sec',
            label: 'Security & Infrastructure',
            items: [
                { key: 'nexus-access', label: 'Access Control', to: '/nexus/security/access_control', icon: <ShieldCheck size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-permissions', label: 'Permission Registry', to: '/nexus/security/permission_registry', icon: <Database size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-settings', label: 'System Settings', to: '/nexus/settings', icon: <Settings size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
                { key: 'nexus-audit', label: 'System Audit Logs', to: '/nexus/audit-logs', icon: <ClipboardList size={20} />, anyOf: [APP_PERMISSIONS.PLATFORM.AUDIT_READ, APP_PERMISSIONS.PLATFORM.SUPER_ADMIN] },
            ],
        },
    ],
};

export const ADMIN_SIDEBAR: SidebarWorkspaceDefinition = {
    title: 'Admin Control',
    subtitle: 'Client-wide setup, governance, and standards',
    icon: <Crown size={13} />,
    sections: [
        {
            id: 'admin_dashboards',
            label: 'Dashboards & Intelligence',
            items: [
                { key: 'branch-dashboard', label: 'BM Dashboard', to: '{consoleBase}/bm-dashboard', icon: <Store size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.DASHBOARD, APP_PERMISSIONS.POS.REPORTS, APP_PERMISSIONS.POS.DAY_MANAGE] },
                { key: 'admin-analytics', label: 'Business Intelligence', to: '{consoleBase}/admin/analytics', icon: <BarChart2 size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.ANALYTICS] },
            ],
        },
        {
            id: 'sec_access',
            label: 'Security & Access',
            items: [
                { key: 'admin-users', label: 'User Directory', to: '{consoleBase}/admin/users', icon: <Users size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SECURITY_USERS, APP_PERMISSIONS.HR.STAFF_READ] },
                { key: 'admin-roles', label: 'Role Management', to: '{consoleBase}/admin/roles', icon: <ShieldCheck size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SECURITY_ROLES] },
                { key: 'admin-security', label: 'Access Control', to: '{consoleBase}/admin/security', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SECURITY_ACCESS, APP_PERMISSIONS.ADMIN.SECURITY_ROLES] },
                { key: 'admin-audit', label: 'Audit Logs', to: '{consoleBase}/admin/audit-logs', icon: <ClipboardList size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.AUDIT_READ] },
                { key: 'admin-user-history', label: 'User History', to: '{consoleBase}/admin/user-history', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.POS.USER_HISTORY_VIEW, APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS, APP_PERMISSIONS.POS.USER_HISTORY_AUDIT, APP_PERMISSIONS.ADMIN.AUDIT_READ] },
            ],
        },
        {
            id: 'org_setup',
            label: 'Organization Setup',
            items: [
                { key: 'setup-branches', label: 'Branch Management', to: '{consoleBase}/setup/branches', icon: <Building2 size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SETUP_BRANCHES] },
                { key: 'setup-counters', label: 'Sale Counters', to: '{consoleBase}/setup/sale-counters', icon: <Monitor size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SETUP_COUNTERS, APP_PERMISSIONS.POS.TILL_MANAGE] },
                { key: 'setup-designations', label: 'Designations', to: '{consoleBase}/setup/designations', icon: <Briefcase size={20} />, anyOf: [APP_PERMISSIONS.HR.DESIGNATIONS, APP_PERMISSIONS.HR.STAFF_WRITE] },
                { key: 'setup-departments', label: 'Departments', to: '{consoleBase}/setup/departments', icon: <Layers size={20} />, anyOf: [APP_PERMISSIONS.HR.DEPARTMENTS, APP_PERMISSIONS.HR.STAFF_WRITE] },
                { key: 'setup-master', label: 'Master Settings', to: '{consoleBase}/setup/master', icon: <Globe size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SETUP_MASTER] },
                { key: 'setup-branding', label: 'Branding & Receipts', to: '{consoleBase}/setup/branding', icon: <Palette size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SETUP_MASTER] },
                { key: 'setup-subscription', label: 'Tenant Subscription', to: '{consoleBase}/admin/subscription', icon: <CreditCard size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SUBSCRIPTION] },
            ],
        },
        {
            id: 'prod_menu',
            label: 'Catalog & Menu Governance',
            items: [
                { key: 'catalog-categories', label: 'Classifications & Categories', to: '{consoleBase}/admin/categories', icon: <Layers size={20} />, anyOf: [APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE] },
                { key: 'catalog-architecture', label: 'Menu Architecture', to: '{consoleBase}/admin/architecture', icon: <LayoutGrid size={20} />, anyOf: [APP_PERMISSIONS.CATALOG.ARCHITECTURE, APP_PERMISSIONS.CATALOG.WRITE] },
                { key: 'catalog-products', label: 'Product Master', to: '{consoleBase}/products', icon: <Package size={20} />, anyOf: [APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE] },
                { key: 'catalog-recipes', label: 'Recipes & BOM', to: '{consoleBase}/recipes', icon: <BookOpen size={20} />, anyOf: [APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE] },
            ],
        },
        {
            id: 'inv_data',
            label: 'Inventory Governance',
            items: [
                { key: 'inv-classifications', label: 'Classifications', to: '{consoleBase}/inventory/setup/classifications', icon: <Layers size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.SETUP] },
                { key: 'inv-categories', label: 'Item Categories', to: '{consoleBase}/inventory/setup/categories', icon: <FolderTree size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.SETUP] },
                { key: 'inv-items', label: 'Item Master', to: '{consoleBase}/inventory/setup/items', icon: <Package size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.SETUP] },
                { key: 'inv-uoms', label: 'UOM Master', to: '{consoleBase}/inventory/setup/uoms', icon: <Ruler size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.SETUP] },
                { key: 'asset-register', label: 'Asset Register', to: '{consoleBase}/inventory/assets/register', icon: <Package size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.ASSETS] },
                { key: 'asset-issue', label: 'Asset Issue/Return', to: '{consoleBase}/inventory/assets/issue', icon: <ArrowLeftRight size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.ASSETS] },
                { key: 'branch-items', label: 'Branch Item Activation', to: '{consoleBase}/inventory/setup/BranchItems', icon: <Settings2 size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.SETUP] },
                { key: 'item-approvals', label: 'Item Approvals', to: '{consoleBase}/inventory/setup/approvals', icon: <CheckCircle2 size={18} />, anyOf: [APP_PERMISSIONS.APPROVAL.APPROVE, APP_PERMISSIONS.INVENTORY.SETUP] },
            ],
        },
        {
            id: 'vendor_mgmt',
            label: 'Procurement & Vendors',
            items: [
                { key: 'vendors', label: 'Vendors', to: '{consoleBase}/inventory/vendors', icon: <Truck size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.VENDORS] },
                { key: 'vendor-dashboard', label: 'Vendor Dashboard', to: '{consoleBase}/inventory/vendor-dashboard', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.VENDORS, APP_PERMISSIONS.ADMIN.ANALYTICS] },
                { key: 'vendor-payments', label: 'Vendor Payments', to: '{consoleBase}/inventory/vendor-payments', icon: <CreditCard size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.PAYMENTS] },
                { key: 'purchase-orders', label: 'Purchase Orders', to: '{consoleBase}/purchase-orders', icon: <Truck size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS] },
            ],
        },
        {
            id: 'acct_finance',
            label: 'Finance & Commercial Control',
            items: [
                { key: 'finance-dashboard', label: 'Finance Dashboard', to: '{consoleBase}/accounting', icon: <Calculator size={20} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.DASHBOARD] },
                { key: 'coa', label: 'Chart of Accounts', to: '{consoleBase}/accounting/chart-of-accounts', icon: <FolderTree size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.COA] },
                { key: 'journals', label: 'Journal Entries', to: '{consoleBase}/accounting/journal-entries', icon: <FileText size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE] },
                { key: 'ledger', label: 'General Ledger', to: '{consoleBase}/accounting/general-ledger', icon: <Scale size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.LEDGER] },
                { key: 'petty-cash', label: 'Petty Cash', to: '{consoleBase}/accounting/petty-cash', icon: <Wallet size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.PETTY_CASH] },
                { key: 'payroll-runs', label: 'Payroll Runs', to: '{consoleBase}/accounting/payroll', icon: <Users size={18} />, anyOf: [APP_PERMISSIONS.HR.PAYROLL_READ, APP_PERMISSIONS.HR.PAYROLL_MANAGE, APP_PERMISSIONS.HR.PAYROLL_APPROVE] },
                { key: 'vouchers', label: 'Vouchers & Expenses', to: '{consoleBase}/accounting/vouchers', icon: <Receipt size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.VOUCHER, APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE] },
                { key: 'voucher-approvals', label: 'Voucher Approvals', to: '{consoleBase}/accounting/voucher-approvals', icon: <CheckCircle2 size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE] },
                { key: 'cashier-expense-admin', label: 'Cashier Expense Entry', to: '{consoleBase}/cashier/expenses', icon: <Receipt size={18} />, anyOf: [APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER] },
                { key: 'void-bills-admin', label: 'Void Bills', to: '{consoleBase}/accounting/void-bills', icon: <ShieldCheck size={18} />, anyOf: [APP_PERMISSIONS.POS.BILL_VOID_VIEW, APP_PERMISSIONS.POS.BILL_VOID_CREATE, APP_PERMISSIONS.POS.BILL_VOID_APPROVE, APP_PERMISSIONS.POS.BILL_VOID_MANAGE] },
                { key: 'user-history-admin', label: 'User Transactions', to: '{consoleBase}/reports/user-history', icon: <UserCheck size={18} />, anyOf: [APP_PERMISSIONS.POS.USER_HISTORY_VIEW, APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS, APP_PERMISSIONS.POS.USER_HISTORY_AUDIT, APP_PERMISSIONS.POS.USER_HISTORY_EXPORT, APP_PERMISSIONS.ADMIN.AUDIT_READ] },
                { key: 'banks', label: 'Treasury Accounts', to: '{consoleBase}/finance/treasury-accounts', icon: <Landmark size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.BANKS] },
                { key: 'recon', label: 'Bank Reconciliation', to: '{consoleBase}/finance/reconciliation', icon: <GitCompareArrows size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.RECON] },
                { key: 'investors', label: 'Investors', to: '{consoleBase}/accounting/investors', icon: <Users size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW, APP_PERMISSIONS.ACCOUNTING.INVESTORS] },
                { key: 'investments', label: 'Investment Records', to: '{consoleBase}/accounting/investments', icon: <Wallet size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW, APP_PERMISSIONS.ACCOUNTING.INVESTORS] },
                { key: 'profit-distribution', label: 'Profit Distribution', to: '{consoleBase}/accounting/profit-distribution', icon: <PiggyBank size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW, APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION] },
                { key: 'loans', label: 'Loans', to: '{consoleBase}/accounting/loans', icon: <HandCoins size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW, APP_PERMISSIONS.ACCOUNTING.LOANS] },
                { key: 'loan-repayments', label: 'Loan Repayments', to: '{consoleBase}/accounting/loan-repayments', icon: <CreditCard size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW, APP_PERMISSIONS.ACCOUNTING.LOANS] },
                { key: 'taxes', label: 'Tax Configuration', to: '{consoleBase}/admin/taxes', icon: <Receipt size={18} />, anyOf: [APP_PERMISSIONS.ADMIN.TAX_CONFIG] },
                { key: 'payment-methods', label: 'Payment Methods', to: '{consoleBase}/admin/payment-methods', icon: <CreditCard size={18} />, anyOf: [APP_PERMISSIONS.ADMIN.PAYMENT_METHODS] },
                { key: 'finance-reports', label: 'Financial Reports', to: '{consoleBase}/accounting/reports', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.REPORTS] },
                { key: 'daily-accounting-reports', label: 'Daily Accounting Reports', to: '{consoleBase}/accounting/daily-reports', icon: <ClipboardList size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.REPORTS] },
                { key: 'finance-settings', label: 'Accounting Settings', to: '{consoleBase}/accounting/settings', icon: <Settings size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.SETTINGS] },
            ],
        },
        {
            id: 'commercial',
            label: 'Commercial & Customer',
            items: [
                { key: 'crm', label: 'Customer CRM', to: '{consoleBase}/crm', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.CRM.CUSTOMERS] },
                { key: 'marketing', label: 'Deals & Marketing', to: '{consoleBase}/marketing', icon: <Tag size={20} />, anyOf: [APP_PERMISSIONS.CRM.DEALS] },
                { key: 'catering', label: 'Catering', to: '{consoleBase}/catering', icon: <Briefcase size={20} />, anyOf: [APP_PERMISSIONS.CRM.CATERING] },
            ],
        },
    ],
};

export const BRANCH_SIDEBAR: SidebarWorkspaceDefinition = {
    title: 'Branch Operations',
    subtitle: 'Current branch execution workspace',
    icon: <Store size={13} />,
    sections: [
        {
            id: 'branch_dashboards',
            label: 'Dashboards & Approvals',
            items: [
                { key: 'bm-dashboard-branch', label: 'BM Dashboard', to: '{consoleBase}/bm-dashboard', icon: <LayoutDashboard size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.DASHBOARD, APP_PERMISSIONS.POS.REPORTS, APP_PERMISSIONS.POS.DAY_MANAGE] },
                { key: 'branch-bi-command', label: 'BI Command Center', to: '{consoleBase}/admin/analytics', icon: <BarChart3 size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.ANALYTICS, APP_PERMISSIONS.POS.REPORTS] },
                { key: 'sales-reports', label: 'Sales Reports', to: '{consoleBase}/reports/sales', icon: <BarChart2 size={20} />, anyOf: [APP_PERMISSIONS.POS.REPORTS] },
                { key: 'branch-user-history', label: 'User History', to: '{consoleBase}/reports/user-history', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.POS.USER_HISTORY_VIEW, APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS, APP_PERMISSIONS.POS.USER_HISTORY_AUDIT, APP_PERMISSIONS.POS.USER_HISTORY_EXPORT, APP_PERMISSIONS.ADMIN.AUDIT_READ] },
            ],
        },
        {
            id: 'cashier_ops',
            label: 'Cashier',
            items: [
                { key: 'terminal', label: 'Point of Sale (POS)', to: '/terminal', icon: <Utensils size={20} />, anyOf: [APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE, APP_PERMISSIONS.POS.DAY_MANAGE, APP_PERMISSIONS.POS.SHIFT_MANAGE, APP_PERMISSIONS.POS.ORDER_EDIT] },
                { key: 'order-taker', label: 'Order Taker POS', to: '/console/order-taker', icon: <ClipboardList size={20} />, anyOf: [APP_PERMISSIONS.POS.ORDER_TAKER], external: true },
                { key: 'kds', label: 'Kitchen Display (KDS)', to: '/terminal/kds', icon: <ChefHat size={20} />, anyOf: [APP_PERMISSIONS.POS.KDS_READ], external: true },
                { key: 'order-search', label: 'Order Search', to: '{consoleBase}/cashier/orders', icon: <Search size={20} />, anyOf: [APP_PERMISSIONS.POS.ORDER_SEARCH, APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE] },
                { key: 'returned-orders', label: 'Sales Returned Orders', to: '{consoleBase}/cashier/returned-orders', icon: <RotateCcw size={20} />, anyOf: [APP_PERMISSIONS.POS.ORDER_SEARCH, APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE] },
                { key: 'credit-payments', label: 'Credit Payments', to: '{consoleBase}/cashier/credit-payments', icon: <CreditCard size={20} />, anyOf: [APP_PERMISSIONS.POS.CREDIT_ORDERS, APP_PERMISSIONS.POS.CREDIT_SETTLE, APP_PERMISSIONS.POS.CASHIER_CONSOLE] },
                { key: 'void-bills', label: 'Void Bills', to: '{consoleBase}/cashier/void-bills', icon: <ShieldCheck size={20} />, anyOf: [APP_PERMISSIONS.POS.BILL_VOID_VIEW, APP_PERMISSIONS.POS.BILL_VOID_CREATE, APP_PERMISSIONS.POS.BILL_VOID_APPROVE, APP_PERMISSIONS.POS.BILL_VOID_MANAGE] },
                { key: 'cashier-user-history', label: 'User History', to: '{consoleBase}/cashier/user-history', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.POS.USER_HISTORY_VIEW, APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS, APP_PERMISSIONS.POS.USER_HISTORY_AUDIT, APP_PERMISSIONS.POS.USER_HISTORY_EXPORT, APP_PERMISSIONS.ADMIN.AUDIT_READ] },
                { key: 'cashier-expense', label: 'Record Expense', to: '{consoleBase}/cashier/expenses', icon: <Receipt size={20} />, anyOf: [APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER] },
            ],
        },
        {
            id: 'daily_ops',
            label: 'Service & Counter Operations',
            items: [
                { key: 'branch-day', label: 'Branch Day', to: '/terminal/day', icon: <Sun size={20} />, anyOf: [APP_PERMISSIONS.POS.DAY_MANAGE, APP_PERMISSIONS.POS.SHIFT_MANAGE, APP_PERMISSIONS.POS.TILL_MANAGE] },
                { key: 'terminal-center', label: 'Terminal Center', to: '/terminal/center', icon: <Monitor size={20} />, anyOf: [APP_PERMISSIONS.ADMIN.SETUP_COUNTERS, APP_PERMISSIONS.POS.TILL_MANAGE] },
            ],
        },
        {
            id: 'pricing_execution',
            label: 'Menu Execution & Pricing',
            items: [
                { key: 'product-pricing', label: 'Product Selection & Pricing', to: '{consoleBase}/products/pricing', icon: <Wallet size={20} />, anyOf: [APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'menu-availability', label: 'Menu Availability', to: '{consoleBase}/products/menu-availability', icon: <ToggleLeft size={20} />, anyOf: [APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.INVENTORY.READ] },
            ],
        },
        {
            id: 'inv_ops',
            label: 'Inventory Execution',
            items: [
                { key: 'inventory-overview', label: 'Inventory Overview', to: '{consoleBase}/inventory', icon: <Boxes size={20} />, anyOf: [APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'stock-balance', label: 'Stock Balance', to: '{consoleBase}/inventory/stock-balance', icon: <Warehouse size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'grn', label: 'Receive Stock (GRN)', to: '{consoleBase}/inventory/grn', icon: <ArrowDownToLine size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE] },
                { key: 'issuance', label: 'Issue to Kitchen', to: '{consoleBase}/inventory/issuance', icon: <ChefHat size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.STOCK_ADJUST, APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'stock-ledger', label: 'Stock Ledger', to: '{consoleBase}/inventory/ledger', icon: <ClipboardList size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'inventory-consumption', label: 'Consumption Dashboard', to: '{consoleBase}/inventory/consumption', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'inventory-reports', label: 'Inventory Reports', to: '{consoleBase}/inventory/reports', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.READ] },
                { key: 'wastage', label: 'Disposal', to: '{consoleBase}/inventory/wastage', icon: <TrendingDown size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.WASTAGE] },
                { key: 'stock-count', label: 'Stock Count', to: '{consoleBase}/inventory/stock-count', icon: <ClipboardList size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.COUNT_VIEW, APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE, APP_PERMISSIONS.INVENTORY.COUNT_PERFORM, APP_PERMISSIONS.INVENTORY.COUNT_REVIEW, APP_PERMISSIONS.INVENTORY.COUNT_REPORT, APP_PERMISSIONS.INVENTORY.MONTH_CLOSE] },
                { key: 'blind-closing', label: 'Closing Dashboard', to: '{consoleBase}/inventory/closing-dashboard', icon: <ShieldCheck size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.COUNT_REPORT, APP_PERMISSIONS.INVENTORY.MONTH_CLOSE] },
                { key: 'ibt', label: 'Inter-Branch Transfer', to: '{consoleBase}/inventory/ibt', icon: <ArrowLeftRight size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER] },
                { key: 'production-supply', label: 'Production Supply', to: '{consoleBase}/production/supply', icon: <ChefHat size={18} />, anyOf: [APP_PERMISSIONS.INVENTORY.READ] },
            ],
        },
        {
            id: 'branch_finance',
            label: 'Branch Finance',
            items: [
                { key: 'branch-finance-dashboard', label: 'Finance Dashboard', to: '{consoleBase}/accounting', icon: <Calculator size={20} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.DASHBOARD] },
                { key: 'branch-journals', label: 'Journal Entries', to: '{consoleBase}/accounting/journal-entries', icon: <FileText size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE] },
                { key: 'branch-ledger', label: 'General Ledger', to: '{consoleBase}/accounting/general-ledger', icon: <Scale size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.LEDGER] },
                { key: 'branch-petty-cash', label: 'Petty Cash', to: '{consoleBase}/accounting/petty-cash', icon: <Wallet size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.PETTY_CASH] },
                { key: 'branch-payroll', label: 'Payroll Runs', to: '{consoleBase}/accounting/payroll', icon: <Users size={18} />, anyOf: [APP_PERMISSIONS.HR.PAYROLL_READ, APP_PERMISSIONS.HR.PAYROLL_MANAGE, APP_PERMISSIONS.HR.PAYROLL_APPROVE] },
                { key: 'branch-vouchers', label: 'Vouchers & Expenses', to: '{consoleBase}/accounting/vouchers', icon: <Receipt size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.VOUCHER, APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE] },
                { key: 'branch-voucher-approvals', label: 'Voucher Approvals', to: '{consoleBase}/accounting/voucher-approvals', icon: <CheckCircle2 size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE] },
                { key: 'branch-banks', label: 'Treasury Accounts', to: '{consoleBase}/finance/treasury-accounts', icon: <Landmark size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.BANKS] },
                { key: 'branch-bank-treasury-reports', label: 'Bank & Treasury Reports', to: '{consoleBase}/finance/bank-reports', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.REPORTS] },
                { key: 'branch-recon', label: 'Bank Reconciliation', to: '{consoleBase}/finance/reconciliation', icon: <GitCompareArrows size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.RECON] },
                { key: 'branch-investors', label: 'Investors', to: '{consoleBase}/accounting/investors', icon: <Users size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW, APP_PERMISSIONS.ACCOUNTING.INVESTORS] },
                { key: 'branch-profit-distribution', label: 'Profit Distribution', to: '{consoleBase}/accounting/profit-distribution', icon: <PiggyBank size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW, APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION] },
                { key: 'branch-loans', label: 'Loans', to: '{consoleBase}/accounting/loans', icon: <HandCoins size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW, APP_PERMISSIONS.ACCOUNTING.LOANS] },
                { key: 'branch-finance-reports', label: 'Financial Reports', to: '{consoleBase}/accounting/reports', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.REPORTS] },
                { key: 'branch-daily-accounting-reports', label: 'Daily Accounting Reports', to: '{consoleBase}/accounting/daily-reports', icon: <ClipboardList size={18} />, anyOf: [APP_PERMISSIONS.ACCOUNTING.REPORTS] },
            ],
        },
        {
            id: 'procure',
            label: 'Vendors & Purchasing',
            items: [
                { key: 'branch-vendors', label: 'Vendors', to: '{consoleBase}/inventory/vendors', icon: <Truck size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.VENDORS] },
                { key: 'branch-vendor-dashboard', label: 'Vendor Dashboard', to: '{consoleBase}/inventory/vendor-dashboard', icon: <BarChart3 size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.VENDORS, APP_PERMISSIONS.ADMIN.ANALYTICS] },
                { key: 'branch-vendor-payments', label: 'Vendor Payments', to: '{consoleBase}/inventory/vendor-payments', icon: <CreditCard size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.PAYMENTS] },
                { key: 'branch-purchase-orders', label: 'Purchase Orders', to: '{consoleBase}/purchase-orders', icon: <Truck size={18} />, anyOf: [APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS] },
            ],
        },
        {
            id: 'floor_seat',
            label: 'Seating & Service Area',
            items: [
                { key: 'layout', label: 'Table Layout', to: '{consoleBase}/seating/layout', icon: <LayoutDashboard size={20} />, anyOf: [APP_PERMISSIONS.SEATING.VIEW, APP_PERMISSIONS.SEATING.MANAGE] },
                { key: 'floors', label: 'Floors / Areas', to: '{consoleBase}/seating/floors', icon: <Layers size={20} />, anyOf: [APP_PERMISSIONS.SEATING.VIEW, APP_PERMISSIONS.SEATING.MANAGE] },
                { key: 'tables', label: 'Tables Management', to: '{consoleBase}/seating/tables', icon: <Store size={20} />, anyOf: [APP_PERMISSIONS.SEATING.VIEW, APP_PERMISSIONS.SEATING.MANAGE] },
                { key: 'qrs', label: 'Table QR Codes', to: '{consoleBase}/seating/qrs', icon: <QrCode size={20} />, anyOf: [APP_PERMISSIONS.SEATING.VIEW, APP_PERMISSIONS.SEATING.MANAGE] },
            ],
        },
        {
            id: 'branch_users',
            label: 'People & Guests',
            items: [
                { key: 'branch-staff', label: 'Branch Staff', to: '{consoleBase}/admin/users', icon: <Users size={20} />, anyOf: [APP_PERMISSIONS.HR.STAFF_READ, APP_PERMISSIONS.ADMIN.SECURITY_USERS] },
                { key: 'attendance', label: 'Staff Attendance', to: '{consoleBase}/staff/attendance', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.HR.ATTENDANCE_READ, APP_PERMISSIONS.HR.ATTENDANCE_MARK] },
                { key: 'payroll-people', label: 'Payroll Runs', to: '{consoleBase}/accounting/payroll', icon: <Users size={20} />, anyOf: [APP_PERMISSIONS.HR.PAYROLL_READ, APP_PERMISSIONS.HR.PAYROLL_MANAGE, APP_PERMISSIONS.HR.PAYROLL_APPROVE] },
                { key: 'branch-customers', label: 'Customers', to: '{consoleBase}/crm', icon: <UserCheck size={20} />, anyOf: [APP_PERMISSIONS.CRM.CUSTOMERS] },
                { key: 'branch-catering', label: 'Catering Events', to: '{consoleBase}/catering', icon: <Briefcase size={20} />, anyOf: [APP_PERMISSIONS.CRM.CATERING] },
            ],
        },
    ],
};
