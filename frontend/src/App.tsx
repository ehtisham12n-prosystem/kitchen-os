import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Component, Suspense, lazy, useEffect } from 'react';
import { ThemeProvider } from './providers/ThemeProvider';

// ─── Eagerly loaded (always needed on startup) ────────────────────────────────
import { AppLayout } from './layouts/AppLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { PermissionRoute } from './components/auth/PermissionRoute';
import { KitchenToastContainer } from './components/ui/KitchenToast/KitchenToast';
import { APP_PERMISSIONS, readStoredUserContext, resolveTenantSlug } from './auth/access';
import { readAuthSessionItem } from './auth/storage';

// ─── Lazy-loaded pages (each becomes its own code-split chunk) ────────────────

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const AdminLoginPage = lazy(() => import('./pages/auth/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const CustomerLoginPage = lazy(() => import('./pages/auth/CustomerLoginPage').then(m => ({ default: m.CustomerLoginPage })));

// Dashboards
const BmDashboard = lazy(() => import('./pages/bmDashboard').then(m => ({ default: m.BmDashboard })));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })));
const PlatformDashboard = lazy(() => import('./pages/platform/PlatformDashboard').then(m => ({ default: m.PlatformDashboard })));
const DesignSystemPreview = lazy(() => import('./pages/DesignSystemPreview').then(m => ({ default: m.DesignSystemPreview })));

// Products
const ProductList = lazy(() => import('./pages/products/ProductList').then(m => ({ default: m.ProductList })));
const ProductForm = lazy(() => import('./pages/products/ProductForm').then(m => ({ default: m.ProductForm })));
const BranchPricing = lazy(() => import('./pages/products/BranchPricing').then(m => ({ default: m.BranchPricing })));

// Setup / Settings
const BranchList = lazy(() => import('./pages/setup/BranchList').then(m => ({ default: m.BranchList })));
const BranchForm = lazy(() => import('./pages/setup/BranchForm').then(m => ({ default: m.BranchForm })));
const Departments = lazy(() => import('./pages/setup/Departments').then(m => ({ default: m.Departments })));
const BranchLocations = lazy(() => import('./pages/setup/BranchLocations').then(m => ({ default: m.BranchLocations })));
const TableManagement = lazy(() => import('./pages/settings/TableManagement').then(m => ({ default: m.TableManagement })));

// Floor & Seating Management
const FloorsList = lazy(() => import('./pages/floor-management/FloorsList').then(m => ({ default: m.FloorsList })));
const TablesList = lazy(() => import('./pages/floor-management/TablesList').then(m => ({ default: m.TablesList })));
const QRManagement = lazy(() => import('./pages/floor-management/QRManagement').then(m => ({ default: m.QRManagement })));
const TableLayout = lazy(() => import('./pages/floor-management/TableLayout').then(m => ({ default: m.TableLayout })));
const GraphicalFloorPlan = lazy(() => import('./pages/floor-management/GraphicalFloorPlan').then(m => ({ default: m.GraphicalFloorPlan })));
const TableAssignment = lazy(() => import('./pages/floor-management/TableAssignment').then(m => ({ default: m.TableAssignment })));

// HR / Staff
const StaffList = lazy(() => import('./pages/hr/StaffList').then(m => ({ default: m.StaffList })));
const StaffForm = lazy(() => import('./pages/hr/StaffForm').then(m => ({ default: m.StaffForm })));
const Designations = lazy(() => import('./pages/hr/Designations').then(m => ({ default: m.Designations })));
const Attendance = lazy(() => import('./pages/hr/Attendance').then(m => ({ default: m.Attendance })));


// POS
const PosTerminal = lazy(() => import('./pages/pos/PosTerminal').then(m => ({ default: m.PosTerminal })));
const KitchenDisplay = lazy(() => import('./pages/pos/KitchenDisplay').then(m => ({ default: m.KitchenDisplay })));
const PosSalesDashboard = lazy(() => import('./pages/pos/PosSalesDashboard').then(m => ({ default: m.PosSalesDashboard })));
const BranchDayManagement = lazy(() => import('./pages/pos/BranchDayManagement').then(m => ({ default: m.BranchDayManagement })));
const OrderTakerPos = lazy(() => import('./pages/pos/OrderTakerPos').then(m => ({ default: m.OrderTakerPos })));
const TerminalDashboard = lazy(() => import('./pages/pos/TerminalDashboard').then(m => ({ default: m.TerminalDashboard })));
const TerminalCenter = lazy(() => import('./pages/setup/TerminalCenter'));
const CashierOrderSearch = lazy(() => import('./pages/cashier/CashierOrderSearch').then(m => ({ default: m.CashierOrderSearch })));
const CashierCreditPayments = lazy(() => import('./pages/cashier/CashierCreditPayments').then(m => ({ default: m.CashierCreditPayments })));
const CashierReturnedOrders = lazy(() => import('./pages/cashier/CashierReturnedOrders').then(m => ({ default: m.CashierReturnedOrders })));
const CashierExpenseEntry = lazy(() => import('./pages/cashier/CashierExpenseEntry').then(m => ({ default: m.CashierExpenseEntry })));
const BillVoidManagement = lazy(() => import('./pages/cashier/BillVoidManagement').then(m => ({ default: m.BillVoidManagement })));
const UserActivityHistory = lazy(() => import('./pages/cashier/UserActivityHistory').then(m => ({ default: m.UserActivityHistory })));

// Inventory
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })));
const VendorList = lazy(() => import('./pages/inventory/VendorList').then(m => ({ default: m.VendorList })));
const VendorForm = lazy(() => import('./pages/inventory/VendorForm').then(m => ({ default: m.VendorForm })));
const VendorPayments = lazy(() => import('./pages/inventory/VendorPayments').then(m => ({ default: m.VendorPayments })));
const VendorPaymentForm = lazy(() => import('./pages/inventory/VendorPaymentForm').then(m => ({ default: m.VendorPaymentForm })));
const VendorPaymentApprovals = lazy(() => import('./pages/inventory/VendorPaymentApprovals').then(m => ({ default: m.VendorPaymentApprovals })));
const VendorDashboard = lazy(() => import('./pages/inventory/VendorDashboard').then(m => ({ default: m.VendorDashboard })));
const PurchaseOrderList = lazy(() => import('./pages/inventory/PurchaseOrderList').then(m => ({ default: m.PurchaseOrderList })));
const PurchaseOrderForm = lazy(() => import('./pages/inventory/PurchaseOrderForm').then(m => ({ default: m.PurchaseOrderForm })));
const RecipeList = lazy(() => import('./pages/inventory/RecipeList').then(m => ({ default: m.RecipeList })));
const RecipeForm = lazy(() => import('./pages/inventory/RecipeForm').then(m => ({ default: m.RecipeForm })));
const StockLedgerList = lazy(() => import('./pages/inventory/StockLedgerList').then(m => ({ default: m.StockLedgerList })));
const InventoryReports = lazy(() => import('./pages/inventory/InventoryReports').then(m => ({ default: m.InventoryReports })));
const InventoryConsumptionDashboard = lazy(() => import('./pages/inventory/InventoryConsumptionDashboard').then(m => ({ default: m.InventoryConsumptionDashboard })));
const StockReceiveForm = lazy(() => import('./pages/inventory/StockReceiveForm').then(m => ({ default: m.StockReceiveForm })));
const StockAdjustForm = lazy(() => import('./pages/inventory/StockAdjustForm').then(m => ({ default: m.StockAdjustForm })));
// Inventory Management (Full Module)
const GRNForm = lazy(() => import('./pages/inventory/GRNForm').then(m => ({ default: m.GRNForm })));
const GRNList = lazy(() => import('./pages/inventory/GRNList').then(m => ({ default: m.GRNList })));
const StockIssuance = lazy(() => import('./pages/inventory/StockIssuance').then(m => ({ default: m.StockIssuance })));
const WastageEntry = lazy(() => import('./pages/inventory/WastageEntry').then(m => ({ default: m.WastageEntry })));
const DisposalEntry = lazy(() => import('./pages/inventory/DisposalEntry').then(m => ({ default: m.DisposalEntry })));
const DisposalApproval = lazy(() => import('./pages/inventory/DisposalApproval').then(m => ({ default: m.DisposalApproval })));
const StockBalance = lazy(() => import('./pages/inventory/StockBalance').then(m => ({ default: m.StockBalance })));
const StockCount = lazy(() => import('./pages/inventory/StockCount').then(m => ({ default: m.StockCount })));
const ClosingDashboard = lazy(() => import('./pages/inventory/ClosingDashboard').then(m => ({ default: m.ClosingDashboard })));
const DemandPlanning = lazy(() => import('./pages/inventory/DemandPlanning').then(m => ({ default: m.DemandPlanning })));
// Inventory Setup (Admin)
const InventoryClassification = lazy(() => import('./pages/inventory/setup/InventoryClassification').then(m => ({ default: m.InventoryClassification })));
const InventoryCategory = lazy(() => import('./pages/inventory/setup/InventoryCategory').then(m => ({ default: m.InventoryCategory })));
const InventoryItemMaster = lazy(() => import('./pages/inventory/setup/InventoryItemMaster').then(m => ({ default: m.InventoryItemMaster })));
const UomMaster = lazy(() => import('./pages/inventory/setup/UomMaster').then(m => ({ default: m.UomMaster })));
const BranchItemSetup = lazy(() => import('./pages/inventory/setup/BranchItemSetup').then(m => ({ default: m.BranchItemSetup })));
const ItemApprovalQueue = lazy(() => import('./pages/inventory/setup/ItemApprovalQueue').then(m => ({ default: m.ItemApprovalQueue })));
const AssetRegister = lazy(() => import('./pages/inventory/assets/AssetRegister').then(m => ({ default: m.AssetRegister })));
const AssetIssue = lazy(() => import('./pages/inventory/assets/AssetIssue').then(m => ({ default: m.AssetIssue })));
const AssetDispose = lazy(() => import('./pages/inventory/assets/AssetDispose').then(m => ({ default: m.AssetDispose })));
const AssetTransfer = lazy(() => import('./pages/inventory/assets/AssetTransfer').then(m => ({ default: m.AssetTransfer })));
// Inter-Branch Transfer
const InterBranchTransferList = lazy(() => import('./pages/inventory/InterBranchTransferList').then(m => ({ default: m.InterBranchTransferList })));
const InterBranchTransferForm = lazy(() => import('./pages/inventory/InterBranchTransferForm').then(m => ({ default: m.InterBranchTransferForm })));
const BranchAuditLog = lazy(() => import('./pages/inventory/BranchAuditLog'));

// Production
const ProductionOrderList = lazy(() => import('./pages/production/ProductionOrderList').then(m => ({ default: m.ProductionOrderList })));
const ProductionOrderForm = lazy(() => import('./pages/production/ProductionOrderForm').then(m => ({ default: m.ProductionOrderForm })));
const ProductionSupplyList = lazy(() => import('./pages/production/ProductionSupplyList').then(m => ({ default: m.ProductionSupplyList })));
const ProductionSupplyForm = lazy(() => import('./pages/production/ProductionSupplyForm').then(m => ({ default: m.ProductionSupplyForm })));

// Accounting / Finance
const AccountingDashboard = lazy(() => import('./pages/accounting/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })));
const ChartOfAccounts = lazy(() => import('./pages/accounting/ChartOfAccounts').then(m => ({ default: m.ChartOfAccounts })));
const JournalEntries = lazy(() => import('./pages/accounting/JournalEntries').then(m => ({ default: m.JournalEntries })));
const GeneralLedger = lazy(() => import('./pages/accounting/GeneralLedger').then(m => ({ default: m.GeneralLedger })));
const InvestorManagement = lazy(() => import('./pages/accounting/InvestorManagement').then(m => ({ default: m.InvestorManagement })));
const InvestmentRecords = lazy(() => import('./pages/accounting/InvestmentRecords').then(m => ({ default: m.InvestmentRecords })));
const ProfitDistribution = lazy(() => import('./pages/accounting/ProfitDistribution').then(m => ({ default: m.ProfitDistribution })));
const LoanManagement = lazy(() => import('./pages/accounting/LoanManagement').then(m => ({ default: m.LoanManagement })));
const LoanRepayments = lazy(() => import('./pages/accounting/LoanRepayments').then(m => ({ default: m.LoanRepayments })));
const AcctTaxConfiguration = lazy(() => import('./pages/accounting/TaxConfiguration').then(m => ({ default: m.TaxConfiguration })));
const FinancialReports = lazy(() => import('./pages/accounting/FinancialReports').then(m => ({ default: m.FinancialReports })));
const DailyAccountingReports = lazy(() => import('./pages/accounting/DailyAccountingReports').then(m => ({ default: m.DailyAccountingReports })));
const CustomerReceivablesControl = lazy(() => import('./pages/accounting/CustomerReceivablesControl').then(m => ({ default: m.CustomerReceivablesControl })));
const EventReceivablesControl = lazy(() => import('./pages/accounting/EventReceivablesControl').then(m => ({ default: m.EventReceivablesControl })));
const PayrollRuns = lazy(() => import('./pages/accounting/PayrollRuns').then(m => ({ default: m.PayrollRuns })));
const AccountingSettings = lazy(() => import('./pages/accounting/AccountingSettings').then(m => ({ default: m.AccountingSettings })));
const FinancialVoucherList = lazy(() => import('./pages/accounting/VoucherList').then(m => ({ default: m.VoucherList })));
const FinancialVoucherApprovals = lazy(() => import('./pages/accounting/VoucherList').then(m => ({ default: m.VoucherApprovals })));
const FinancialVoucherForm = lazy(() => import('./pages/accounting/VoucherForm').then(m => ({ default: m.VoucherForm })));
const BankManagement = lazy(() => import('./pages/finance/BankManagement').then(m => ({ default: m.BankManagement })));
const BankTreasuryReports = lazy(() => import('./pages/finance/BankTreasuryReports').then(m => ({ default: m.BankTreasuryReports })));
const BankReconciliation = lazy(() => import('./pages/finance/BankReconciliation').then(m => ({ default: m.BankReconciliation })));
const PettyCash = lazy(() => import('./pages/accounting/PettyCash').then(m => ({ default: m.PettyCash })));

// CRM / Customers / Deals
const CustomerList = lazy(() => import('./pages/customers/CustomerList').then(m => ({ default: m.CustomerList })));
const VoucherList = lazy(() => import('./pages/deals/VoucherList').then(m => ({ default: m.VoucherList })));
const CateringManagement = lazy(() => import('./pages/catering/CateringManagement').then(m => ({ default: m.CateringManagement })));

// Platform Admin
const ClientManagement = lazy(() => import('./pages/platform/ClientManagement').then(m => ({ default: m.ClientManagement })));
const ClientEditor = lazy(() => import('./pages/platform/ClientEditor').then(m => ({ default: m.ClientEditor })));
const ClientDetail = lazy(() => import('./pages/platform/ClientDetail').then(m => ({ default: m.ClientDetail })));
const OrganizationSettings = lazy(() => import('./pages/platform/OrganizationSettings').then(m => ({ default: m.OrganizationSettings })));
const ThemeList = lazy(() => import('./pages/platform/ThemeList').then(m => ({ default: m.ThemeList })));
const ThemeForm = lazy(() => import('./pages/platform/ThemeForm').then(m => ({ default: m.ThemeForm })));
const SubscriptionGroupList = lazy(() => import('./pages/platform/SubscriptionGroupList').then(m => ({ default: m.SubscriptionGroupList })));
const SubscriptionGroupForm = lazy(() => import('./pages/platform/SubscriptionGroupForm').then(m => ({ default: m.SubscriptionGroupForm })));
const SubscriptionPlanDetail = lazy(() => import('./pages/platform/SubscriptionPlanDetail').then(m => ({ default: m.SubscriptionPlanDetail })));
const FeatureRegistry = lazy(() => import('./pages/platform/FeatureRegistry').then(m => ({ default: m.FeatureRegistry })));
const OnboardingQueue = lazy(() => import('./pages/platform/OnboardingQueue').then(m => ({ default: m.OnboardingQueue })));
const OnboardingWorkspace = lazy(() => import('./pages/platform/OnboardingWorkspace').then(m => ({ default: m.OnboardingWorkspace })));
const BlueprintList = lazy(() => import('./pages/platform/BlueprintList').then(m => ({ default: m.BlueprintList })));
const BlueprintForm = lazy(() => import('./pages/platform/BlueprintForm').then(m => ({ default: m.BlueprintForm })));
const BlueprintDetail = lazy(() => import('./pages/platform/BlueprintDetail').then(m => ({ default: m.BlueprintDetail })));
const SupportClient360 = lazy(() => import('./pages/platform/SupportClient360').then(m => ({ default: m.SupportClient360 })));

// Security (Platform)
const AccessControl = lazy(() => import('./pages/platform/security/AccessControl/AccessControl').then(m => ({ default: m.AccessControl })));
const PermissionRegistry = lazy(() => import('./pages/platform/security/Registry/PermissionRegistry').then(m => ({ default: m.PermissionRegistry })));
const AuditLogList = lazy(() => import('./pages/platform/AuditLogList'));
const InvoiceManagement = lazy(() => import('./pages/platform/InvoiceManagement'));
const AnnouncementManagement = lazy(() => import('./pages/platform/AnnouncementManagement'));
const UsageRadar = lazy(() => import('./pages/platform/UsageRadar'));
const SupportHub = lazy(() => import('./pages/platform/SupportHub'));
const SystemUserList = lazy(() => import('./pages/platform/SystemUserList').then(m => ({ default: m.SystemUserList })));
const SystemUserEditor = lazy(() => import('./pages/platform/SystemUserEditor').then(m => ({ default: m.SystemUserEditor })));

// Tenant HQ / Admin
const DistributionCenter = lazy(() => import('./pages/admin/DistributionCenter').then(m => ({ default: m.DistributionCenter })));
const TaxConfiguration = lazy(() => import('./pages/admin/TaxConfiguration').then(m => ({ default: m.TaxConfiguration })));
const PaymentMethods = lazy(() => import('./pages/admin/PaymentMethods').then(m => ({ default: m.PaymentMethods })));

// Menu Management (System Platform)
const MenuCategories = lazy(() => import('./pages/menu-management/MenuCategories').then(m => ({ default: m.MenuCategories })));
const MenuTypes = lazy(() => import('./pages/menu-management/MenuTypes').then(m => ({ default: m.MenuTypes })));
const CuisineTypes = lazy(() => import('./pages/menu-management/CuisineTypes').then(m => ({ default: m.CuisineTypes })));
const PrepStations = lazy(() => import('./pages/menu-management/PrepStations').then(m => ({ default: m.PrepStations })));
const OrderTypes = lazy(() => import('./pages/menu-management/OrderTypes').then(m => ({ default: m.OrderTypes })));
const MenuAvailabilityManager = lazy(() => import('./pages/menu-management/MenuAvailabilityManager').then(m => ({ default: m.MenuAvailabilityManager })));

// AI & Analytics
const AiSalesForecaster = lazy(() => import('./pages/analytics/AiSalesForecaster').then(m => ({ default: m.AiSalesForecaster })));
const WasteAnalytics = lazy(() => import('./pages/analytics/WasteAnalytics').then(m => ({ default: m.WasteAnalytics })));
const MultiBranchAnalytics = lazy(() => import('./pages/analytics/MultiBranchAnalytics').then(m => ({ default: m.MultiBranchAnalytics })));
const RestaurantBiCommandCenter = lazy(() => import('./pages/analytics/RestaurantBiCommandCenter').then(m => ({ default: m.RestaurantBiCommandCenter })));

// Client Portal
const BranchManagement = lazy(() => import('./pages/client-portal/BranchManagement').then(m => ({ default: m.BranchManagement })));
const UserRegistry = lazy(() => import('./pages/client-portal/UserRegistry').then(m => ({ default: m.UserRegistry })));
const UserEditor = lazy(() => import('./pages/client-portal/UserEditor').then(m => ({ default: m.UserEditor })));
const MyAccountPage = lazy(() => import('./pages/account/MyAccountPage').then(m => ({ default: m.MyAccountPage })));
const RoleManagement = lazy(() => import('./pages/admin/RoleManagement').then(m => ({ default: m.RoleManagement })));
const CategoryManagement = lazy(() => import('./pages/admin/CategoryManagement').then(m => ({ default: m.CategoryManagement })));
const CatalogArchitecture = lazy(() => import('./pages/admin/CatalogArchitecture').then(m => ({ default: m.CatalogArchitecture })));
const BranchSettings = lazy(() => import('./pages/client-portal/BranchSettings').then(m => ({ default: m.BranchSettings })));
const MasterSetup = lazy(() => import('./pages/client-portal/MasterSetup').then(m => ({ default: m.MasterSetup })));
const SubscriptionDetails = lazy(() => import('./pages/client-portal/SubscriptionDetails').then(m => ({ default: m.SubscriptionDetails })));
const ClientBrandingSettings = lazy(() => import('./pages/client-portal/ClientBrandingSettings').then(m => ({ default: m.ClientBrandingSettings })));

// Security (Client)
const ClientPermissionManagement = lazy(() => import('./pages/client-portal/security/PermissionManagement').then(m => ({ default: m.PermissionManagement })));
const ClientGroupManagementPage = lazy(() => import('./pages/client-portal/security/GroupManagement').then(m => ({ default: m.GroupManagement })));
const ClientUserAccessManagement = lazy(() => import('./pages/client-portal/security/UserAccessManagement').then(m => ({ default: m.UserAccessManagement })));
const ConsoleAuditLogList = lazy(() => import('./pages/client-portal/AuditLogList'));


// ─── Universal Console Path Redirect ────────────────────────────────────────────
// Components that navigate to /products as an absolute path will hit this.
// This preserves the rest of the path (e.g., /products/new -> /console/products/new)
function ConsolePathRedirect() {
  const location = useLocation();
  const tenantSlug = resolveTenantSlug(readStoredUserContext());
  const consoleRoot = tenantSlug ? `/console/${tenantSlug}` : '/console/access-required';
  return <Navigate to={`${consoleRoot}${location.pathname}`} replace />;
}

// ─── Page Loading Fallback ────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '3px solid var(--bg-tertiary)',
        borderTopColor: 'var(--accent-primary)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ConsoleHomeDashboard() {
  const currentUserType = readAuthSessionItem('user_type') || 'client';
  return currentUserType === 'client' || currentUserType === 'system'
    ? <Navigate to="client/setup" replace />
    : <Navigate to="bm-dashboard" replace />;
}

function ConsoleSlugRequired() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '32px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%)',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          background: '#ffffff',
          border: '1px solid #dbe7f3',
          borderRadius: '24px',
          padding: '40px 32px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '96px',
            height: '96px',
            margin: '0 auto 20px',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '48px',
              height: '34px',
              borderRadius: '10px',
              background: '#2563eb',
              boxShadow: '0 8px 18px rgba(37, 99, 235, 0.25)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '10px',
                width: '28px',
                height: '20px',
                border: '4px solid #0f172a',
                borderBottom: 'none',
                borderRadius: '16px 16px 0 0',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '20px',
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: '#ffffff',
              }}
            />
          </div>
        </div>
        <h1 style={{ marginBottom: '12px', fontSize: '32px', color: '#0f172a' }}>Use Your Official Access Link</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, color: '#334155', marginBottom: '12px' }}>
          This portal can only be opened through your official sign-in link.
          Please use the link provided to you.
        </p>
        <div
          style={{
            display: 'inline-block',
            maxWidth: '100%',
            padding: '10px 16px',
            borderRadius: '12px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontFamily: 'monospace',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            marginBottom: '4px',
          }}
        >
          /console/your-official-name/auth
        </div>
        <p style={{ opacity: 0.7, lineHeight: 1.7, marginTop: '12px', color: '#475569' }}>
          If you do not have the correct link, please contact your administrator or support team for help.
        </p>
      </div>
    </div>
  );
}

// Route-level permission bundles keep console access rules explicit and maintainable.
const BRANCH_DASHBOARD_PERMISSIONS = [
  APP_PERMISSIONS.POS.REPORTS,
  APP_PERMISSIONS.POS.DAY_MANAGE,
  APP_PERMISSIONS.POS.TILL_MANAGE,
  APP_PERMISSIONS.INVENTORY.READ,
  APP_PERMISSIONS.HR.STAFF_READ,
];
const CATALOG_VIEW_PERMISSIONS = [APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE];
const CATALOG_MANAGE_PERMISSIONS = [APP_PERMISSIONS.CATALOG.WRITE];
const CATALOG_ARCHITECTURE_PERMISSIONS = [APP_PERMISSIONS.CATALOG.ARCHITECTURE, APP_PERMISSIONS.CATALOG.WRITE];
const BRANCH_SETUP_PERMISSIONS = [APP_PERMISSIONS.ADMIN.SETUP_BRANCHES];
const BRANCH_SETTINGS_PERMISSIONS = [APP_PERMISSIONS.ADMIN.SETUP_BRANCHES, APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS];
const INVENTORY_LOCATION_PERMISSIONS = [APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE];
const BLIND_COUNT_WORKSPACE_PERMISSIONS = [
  APP_PERMISSIONS.INVENTORY.COUNT_VIEW,
  APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE,
  APP_PERMISSIONS.INVENTORY.COUNT_PERFORM,
  APP_PERMISSIONS.INVENTORY.COUNT_REVIEW,
  APP_PERMISSIONS.INVENTORY.COUNT_RECONCILE,
  APP_PERMISSIONS.INVENTORY.COUNT_REPORT,
  APP_PERMISSIONS.INVENTORY.MONTH_CLOSE,
];
const BLIND_COUNT_DASHBOARD_PERMISSIONS = [
  APP_PERMISSIONS.INVENTORY.COUNT_REPORT,
  APP_PERMISSIONS.INVENTORY.MONTH_CLOSE,
];
const USER_ADMIN_PERMISSIONS = [APP_PERMISSIONS.ADMIN.SECURITY_USERS];
const ROLE_ADMIN_PERMISSIONS = [APP_PERMISSIONS.ADMIN.SECURITY_ROLES];
const ACCESS_CONTROL_PERMISSIONS = [APP_PERMISSIONS.ADMIN.SECURITY_ACCESS, APP_PERMISSIONS.ADMIN.SECURITY_ROLES];
const AUDIT_PERMISSIONS = [APP_PERMISSIONS.ADMIN.AUDIT_READ, APP_PERMISSIONS.APPROVAL.VIEW];
const SUBSCRIPTION_PERMISSIONS = [
  APP_PERMISSIONS.ADMIN.SUBSCRIPTION,
  APP_PERMISSIONS.ADMIN.SECURITY_USERS,
  APP_PERMISSIONS.ADMIN.SECURITY_ROLES,
  APP_PERMISSIONS.ADMIN.SETUP_BRANCHES,
  APP_PERMISSIONS.HR.STAFF_READ,
];
const TAX_AND_PAYMENT_ADMIN_PERMISSIONS = [
  APP_PERMISSIONS.ADMIN.SETUP_BRANCHES,
  APP_PERMISSIONS.ADMIN.TAX_CONFIG,
  APP_PERMISSIONS.ADMIN.PAYMENT_METHODS,
];
const PROCUREMENT_PERMISSIONS = [APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS, APP_PERMISSIONS.PROCUREMENT.VENDORS, APP_PERMISSIONS.PROCUREMENT.PAYMENTS];
const INVENTORY_SETUP_PERMISSIONS = [APP_PERMISSIONS.INVENTORY.SETUP, APP_PERMISSIONS.CATALOG.WRITE];
const INVENTORY_ASSET_VIEW_PERMISSIONS = [APP_PERMISSIONS.INVENTORY.ASSETS_VIEW, APP_PERMISSIONS.INVENTORY.ASSETS];
const INVENTORY_ASSET_MANAGE_PERMISSIONS = [APP_PERMISSIONS.INVENTORY.ASSETS];
const SEATING_PERMISSIONS = [APP_PERMISSIONS.SEATING.VIEW, APP_PERMISSIONS.SEATING.MANAGE, APP_PERMISSIONS.SERVICE.VIEW, APP_PERMISSIONS.SERVICE.MANAGE, APP_PERMISSIONS.POS.DAY_MANAGE];
const CASHIER_ORDER_DESK_PERMISSIONS = [
  APP_PERMISSIONS.POS.ORDER_READ,
  APP_PERMISSIONS.POS.ORDER_SEARCH,
  APP_PERMISSIONS.POS.CASHIER_CONSOLE,
];
const CASHIER_CREDIT_DESK_PERMISSIONS = [
  APP_PERMISSIONS.POS.ORDER_READ,
  APP_PERMISSIONS.POS.CREDIT_ORDERS,
  APP_PERMISSIONS.POS.CASHIER_CONSOLE,
  APP_PERMISSIONS.POS.CREDIT_SETTLE,
];
const CASHIER_EXPENSE_DESK_PERMISSIONS = [
  APP_PERMISSIONS.POS.CASHIER_CONSOLE,
  APP_PERMISSIONS.POS.TILL_MANAGE,
  APP_PERMISSIONS.ACCOUNTING.VOUCHER,
];
const BILL_VOID_PERMISSIONS = [
  APP_PERMISSIONS.POS.BILL_VOID_VIEW,
  APP_PERMISSIONS.POS.BILL_VOID_CREATE,
  APP_PERMISSIONS.POS.BILL_VOID_APPROVE,
  APP_PERMISSIONS.POS.BILL_VOID_MANAGE,
];
const USER_HISTORY_PERMISSIONS = [
  APP_PERMISSIONS.POS.USER_HISTORY_VIEW,
  APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS,
  APP_PERMISSIONS.POS.USER_HISTORY_AUDIT,
  APP_PERMISSIONS.POS.USER_HISTORY_EXPORT,
  APP_PERMISSIONS.ADMIN.AUDIT_READ,
];
const CRM_CUSTOMER_CONSOLE_PERMISSIONS = [
  APP_PERMISSIONS.CRM.CUSTOMERS,
  APP_PERMISSIONS.CRM.CUSTOMERS_CREATE,
  APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
];
const CRM_DEALS_CONSOLE_PERMISSIONS = [
  APP_PERMISSIONS.CRM.DEALS,
  APP_PERMISSIONS.CRM.DEALS_MANAGE,
];
const CRM_CATERING_CONSOLE_PERMISSIONS = [
  APP_PERMISSIONS.CRM.CATERING,
  APP_PERMISSIONS.CRM.CATERING_MANAGE,
];
const ACCOUNT_SELF_SERVICE_PERMISSIONS = [
  APP_PERMISSIONS.POS.ORDER_READ,
  APP_PERMISSIONS.POS.ORDER_CREATE,
  APP_PERMISSIONS.CRM.CUSTOMERS,
  APP_PERMISSIONS.HR.STAFF_READ,
  APP_PERMISSIONS.ADMIN.SETUP_BRANCHES,
  APP_PERMISSIONS.PLATFORM.SUPPORT_READ,
];

// Console routes are grouped by business capability so page locks remain easy to audit.
const consoleRoutes = (
  <>
    <Route index element={<ConsoleHomeDashboard />} />
    <Route element={<PermissionRoute anyOf={BRANCH_DASHBOARD_PERMISSIONS} />}>
      <Route path="bm-dashboard" element={<BmDashboard />} />
    </Route>

    {/* Catalog browsing */}
    <Route element={<PermissionRoute anyOf={CATALOG_VIEW_PERMISSIONS} feature="catalog" />}>
      <Route path="products" element={<ProductList />} />
    </Route>
    {/* Catalog authoring and branch pricing */}
    <Route element={<PermissionRoute anyOf={CATALOG_MANAGE_PERMISSIONS} feature="catalog" />}>
      <Route path="products/new" element={<ProductForm />} />
      <Route path="products/:id" element={<ProductForm />} />
      <Route path="products/availability" element={<Navigate to="/console/products/pricing" replace />} />
      <Route path="products/pricing" element={<BranchPricing />} />
      <Route path="products/menu-availability" element={<MenuAvailabilityManager />} />
    </Route>

    {/* Organization and branch setup */}
    <Route element={<PermissionRoute anyOf={BRANCH_SETUP_PERMISSIONS} feature="auth" />}>
      <Route path="setup/branches" element={<BranchList />} />
      <Route path="setup/branches/new" element={<BranchForm />} />
      <Route path="setup/branches/:id" element={<BranchForm />} />
      <Route path="setup/master" element={<MasterSetup />} />
      <Route path="setup/branding" element={<ClientBrandingSettings />} />
      <Route path="setup/departments" element={<Departments />} />
      <Route path="setup/designations" element={<Designations />} />
    </Route>
    <Route element={<PermissionRoute anyOf={BRANCH_SETTINGS_PERMISSIONS} feature="inventory" />}>
      <Route path="setup/branches/:id/settings" element={<BranchSettings />} />
    </Route>
    <Route element={<PermissionRoute anyOf={INVENTORY_LOCATION_PERMISSIONS} feature="inventory" />}>
      <Route path="setup/locations" element={<BranchLocations />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ADMIN.SETUP_BRANCHES, APP_PERMISSIONS.POS.TILL_MANAGE]} feature="pos" />}>
      <Route path="setup/counters" element={<Navigate to="/terminal/center?tab=registry" replace />} />
      <Route path="setup/sale-counters" element={<Navigate to="/terminal/center?tab=registry" replace />} />
    </Route>
    {/* User administration */}
    <Route element={<PermissionRoute anyOf={USER_ADMIN_PERMISSIONS} />}>
      <Route path="admin/users" element={<UserRegistry />} />
      <Route path="admin/users/new" element={<UserEditor />} />
      <Route path="admin/users/:id" element={<UserEditor />} />
    </Route>
    {/* Staff records */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.HR.STAFF_READ, APP_PERMISSIONS.HR.ATTENDANCE_READ, APP_PERMISSIONS.HR.ATTENDANCE_MARK, APP_PERMISSIONS.HR.PAYROLL_READ, APP_PERMISSIONS.HR.PAYROLL_MANAGE, APP_PERMISSIONS.HR.PAYROLL_APPROVE]} />}>
      <Route path="staff" element={<StaffList />} />
      <Route path="staff/new" element={<StaffForm />} />
      <Route path="staff/:id" element={<StaffForm />} />
      <Route path="staff/attendance" element={<Attendance />} />
    </Route>

    {/* Floor & Seating */}
    <Route element={<PermissionRoute anyOf={SEATING_PERMISSIONS} feature="seating" />}>
      <Route path="seating/floors" element={<FloorsList />} />
      <Route path="seating/tables" element={<TablesList />} />
      <Route path="seating/qrs" element={<QRManagement />} />
      <Route path="seating/layout" element={<TableLayout />} />
      {/* Legacy/Extended Table Views */}
      <Route path="seating/assignment" element={<TableAssignment />} />
      <Route path="seating/graphical" element={<GraphicalFloorPlan />} />
      <Route path="seating/management-old" element={<TableManagement />} />
    </Route>

    {/* Operations */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.ORDER_TAKER]} feature="pos" />}>
      <Route path="order-taker" element={<OrderTakerPos />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CASHIER_ORDER_DESK_PERMISSIONS} feature="pos" />}>
      <Route path="cashier/orders" element={<CashierOrderSearch />} />
      <Route path="cashier/returned-orders" element={<CashierReturnedOrders />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CASHIER_CREDIT_DESK_PERMISSIONS} feature="pos" />}>
      <Route path="cashier/credit-payments" element={<CashierCreditPayments />} />
    </Route>
    <Route element={<PermissionRoute anyOf={BILL_VOID_PERMISSIONS} feature="pos" />}>
      <Route path="cashier/void-bills" element={<BillVoidManagement />} />
      <Route path="accounting/void-bills" element={<BillVoidManagement />} />
    </Route>
    <Route element={<PermissionRoute anyOf={USER_HISTORY_PERMISSIONS} feature="pos" />}>
      <Route path="admin/user-history" element={<UserActivityHistory />} />
      <Route path="reports/user-history" element={<UserActivityHistory />} />
      <Route path="cashier/user-history" element={<UserActivityHistory />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CASHIER_EXPENSE_DESK_PERMISSIONS} feature="pos" />}>
      <Route path="cashier/expenses" element={<CashierExpenseEntry />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.READ, APP_PERMISSIONS.INVENTORY.STOCK_ADJUST, APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE, APP_PERMISSIONS.INVENTORY.COUNT_VIEW, APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE, APP_PERMISSIONS.INVENTORY.COUNT_PERFORM, APP_PERMISSIONS.INVENTORY.COUNT_REVIEW, APP_PERMISSIONS.INVENTORY.COUNT_REPORT, APP_PERMISSIONS.INVENTORY.MONTH_CLOSE]} feature="inventory" />}>
      <Route path="inventory" element={<InventoryDashboard />} />
      <Route path="inventory/issuance" element={<StockIssuance />} />
      <Route path="inventory/issuance/new" element={<StockIssuance />} />
      <Route path="inventory/wastage" element={<WastageEntry />} />
      <Route path="inventory/wastage/new" element={<DisposalEntry />} />
      <Route path="inventory/wastage/approval" element={<DisposalApproval />} />
      <Route path="inventory/stock-balance" element={<StockBalance />} />
      <Route path="inventory/demand" element={<DemandPlanning />} />
      <Route path="inventory/ledger" element={<StockLedgerList />} />
      <Route path="inventory/consumption" element={<InventoryConsumptionDashboard />} />
      <Route path="inventory/reports" element={<InventoryReports />} />
      <Route path="inventory/receive" element={<StockReceiveForm />} />
      <Route path="inventory/adjust" element={<StockAdjustForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.READ, APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE]} feature="inventory" />}>
      <Route path="inventory/grn" element={<GRNList />} />
      <Route path="inventory/grn/:id" element={<GRNForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE]} feature="inventory" />}>
      <Route path="inventory/grn/new" element={<GRNForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={BLIND_COUNT_WORKSPACE_PERMISSIONS} feature="inventory" />}>
      <Route path="inventory/stock-count" element={<StockCount />} />
    </Route>
    <Route element={<PermissionRoute anyOf={BLIND_COUNT_DASHBOARD_PERMISSIONS} feature="inventory" />}>
      <Route path="inventory/closing-dashboard" element={<ClosingDashboard />} />
    </Route>
    {/* Vendor Management */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PROCUREMENT.VENDORS, APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE]} feature="procurement" />}>
      <Route path="inventory/vendors" element={<VendorList />} />
      <Route path="inventory/vendors/:id" element={<VendorForm />} />
      <Route path="inventory/vendor-dashboard" element={<VendorDashboard />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE]} feature="procurement" />}>
      <Route path="inventory/vendors/new" element={<VendorForm />} />
      <Route path="inventory/vendors/:id/edit" element={<VendorForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PROCUREMENT.PAYMENTS, APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE, APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE]} feature="procurement" />}>
      <Route path="inventory/vendor-payments" element={<VendorPayments />} />
      <Route path="inventory/vendor-payments/history" element={<Navigate to="/console/inventory/vendor-payments" replace />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE, APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE]} feature="procurement" />}>
      <Route path="inventory/vendor-payments/new" element={<VendorPaymentForm />} />
      <Route path="inventory/vendor-payments/voucher" element={<Navigate to="/console/inventory/vendor-payments/new" replace />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE]} feature="procurement" />}>
      <Route path="inventory/vendor-payments/approvals" element={<VendorPaymentApprovals />} />
    </Route>
    {/* Inventory Setup (Admin-only pages) */}
    <Route element={<PermissionRoute anyOf={INVENTORY_SETUP_PERMISSIONS} feature="inventory" />}>
      <Route path="inventory/setup/classifications" element={<InventoryClassification />} />
      <Route path="inventory/setup/categories" element={<InventoryCategory />} />
      <Route path="inventory/setup/items" element={<InventoryItemMaster />} />
      <Route path="inventory/setup/uoms" element={<UomMaster />} />
      <Route path="inventory/setup/approvals" element={<ItemApprovalQueue />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.READ, APP_PERMISSIONS.INVENTORY.STOCK_ADJUST]} />}>
      <Route path="inventory/setup/BranchItems" element={<BranchItemSetup />} />
    </Route>
    {/* Asset Register — dedicated per-unit tracking for ASSET classification */}
    <Route element={<PermissionRoute anyOf={INVENTORY_ASSET_VIEW_PERMISSIONS} feature="inventory" />}>
      <Route path="inventory/assets/register" element={<AssetRegister />} />
    </Route>
    <Route element={<PermissionRoute anyOf={INVENTORY_ASSET_MANAGE_PERMISSIONS} feature="inventory" />}>
      <Route path="inventory/assets/issue" element={<AssetIssue />} />
      <Route path="inventory/assets/dispose" element={<AssetDispose />} />
      <Route path="inventory/assets/transfer" element={<AssetTransfer />} />
    </Route>
    {/* Inter-Branch Transfer */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER, APP_PERMISSIONS.INVENTORY.STOCK_ADJUST]} feature="inventory" />}>
      <Route path="inventory/transfer" element={<Navigate to="/console/inventory/ibt" replace />} />
      <Route path="inventory/transfer/new" element={<Navigate to="/console/inventory/ibt/new" replace />} />
      <Route path="inventory/transfers" element={<Navigate to="/console/inventory/ibt" replace />} />
      <Route path="inventory/ibt" element={<InterBranchTransferList />} />
      <Route path="inventory/ibt/new" element={<InterBranchTransferForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER, APP_PERMISSIONS.INVENTORY.STOCK_ADJUST, APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE]} feature="inventory" />}>
      <Route path="inventory/ibt/:id" element={<InterBranchTransferForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={AUDIT_PERMISSIONS} feature="auth" />}>
      <Route path="inventory/audit-logs" element={<BranchAuditLog />} />
      <Route path="admin/audit-logs" element={<ConsoleAuditLogList />} />
    </Route>
    <Route element={<PermissionRoute anyOf={SUBSCRIPTION_PERMISSIONS} feature="auth" />}>
      <Route path="admin/subscription" element={<SubscriptionDetails />} />
      </Route>
    <Route element={<PermissionRoute allOf={[APP_PERMISSIONS.POS.REPORTS, APP_PERMISSIONS.INVENTORY.READ]} feature="analytics" />}>
      <Route path="dashboard" element={<DashboardHome />} />
      <Route path="admin/analytics" element={<RestaurantBiCommandCenter />} />
      <Route path="analytics/branches" element={<MultiBranchAnalytics />} />
      </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ADMIN.SETUP_BRANCHES]} feature="auth" />}>
      <Route path="admin/designations" element={<Designations />} />
    </Route>

    {/* Client Portal (Unified) */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ADMIN.SETUP_BRANCHES, APP_PERMISSIONS.HR.STAFF_READ]} feature="auth" />}>
      <Route path="client/branches" element={<BranchManagement />} />
      <Route path="client/branches/new" element={<BranchForm />} />
      <Route path="client/branches/:id" element={<BranchForm />} />
      <Route path="client/setup" element={<MasterSetup />} />
      <Route path="client/branding" element={<ClientBrandingSettings />} />
    </Route>
    <Route element={<PermissionRoute anyOf={BRANCH_SETTINGS_PERMISSIONS} feature="inventory" />}>
      <Route path="client/branches/:id/settings" element={<BranchSettings />} />
    </Route>
    <Route element={<PermissionRoute anyOf={ACCESS_CONTROL_PERMISSIONS} feature="auth" />}>
      <Route path="client/security" element={<Navigate to="/console/client/security/access" replace />} />
      <Route path="client/security/permissions" element={<ClientPermissionManagement />} />
      <Route path="client/security/groups" element={<ClientGroupManagementPage />} />
      <Route path="client/security/access" element={<ClientUserAccessManagement />} />
    </Route>

    {/* Admin Unified Shortcuts */}
    <Route element={<PermissionRoute anyOf={ROLE_ADMIN_PERMISSIONS} />}>
      <Route path="admin/roles" element={<RoleManagement />} />
    </Route>
    <Route element={<PermissionRoute anyOf={ACCESS_CONTROL_PERMISSIONS} feature="auth" />}>
      <Route path="admin/security" element={<ClientUserAccessManagement />} />
    </Route>
    <Route element={<PermissionRoute anyOf={ACCOUNT_SELF_SERVICE_PERMISSIONS} />}>
      <Route path="account" element={<MyAccountPage />} />
      <Route path="profile" element={<Navigate to="account" replace />} />
      <Route path="settings/password" element={<Navigate to="account?tab=security" replace />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CATALOG_ARCHITECTURE_PERMISSIONS} feature="catalog" />}>
      <Route path="admin/categories" element={<CategoryManagement />} />
      <Route path="admin/architecture" element={<CatalogArchitecture />} />
    </Route>

    {/* Admin Specific Tools */}
    <Route element={<PermissionRoute anyOf={TAX_AND_PAYMENT_ADMIN_PERMISSIONS} feature="auth" />}>
      <Route path="admin/taxes" element={<TaxConfiguration />} />
      <Route path="admin/payment-methods" element={<PaymentMethods />} />
      <Route path="admin/distribution" element={<DistributionCenter />} />
    </Route>

    {/* Production */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.INVENTORY.READ, APP_PERMISSIONS.INVENTORY.STOCK_ADJUST, APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE]} feature="production" />}>
      <Route path="production" element={<ProductionOrderList />} />
      <Route path="production/new" element={<ProductionOrderForm />} />
      <Route path="production/supply" element={<ProductionSupplyList />} />
      <Route path="production/supply/new" element={<ProductionSupplyForm />} />
      <Route path="production/supply/:id" element={<ProductionSupplyForm />} />
      <Route path="production/:id" element={<ProductionOrderForm />} />
    </Route>

    {/* Recipes */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_READ, APP_PERMISSIONS.CATALOG.RECIPE_WRITE]} feature="recipe" />}>
      <Route path="recipes" element={<RecipeList />} />
      <Route path="recipes/:id" element={<RecipeForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.CATALOG.WRITE, APP_PERMISSIONS.CATALOG.RECIPE_WRITE]} feature="recipe" />}>
      <Route path="recipes/new" element={<RecipeForm />} />
    </Route>

    {/* Procurement */}
    <Route element={<PermissionRoute anyOf={PROCUREMENT_PERMISSIONS} feature="procurement" />}>
      <Route path="purchase-orders" element={<PurchaseOrderList />} />
      <Route path="purchase-orders/:id" element={<PurchaseOrderForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE, APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_APPROVE]} feature="procurement" />}>
      <Route path="purchase-orders/new" element={<PurchaseOrderForm />} />
    </Route>


    {/* Accounting & Finance */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.DASHBOARD]} feature="accounting" />}>
      <Route path="accounting" element={<AccountingDashboard />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.BANKS, APP_PERMISSIONS.ACCOUNTING.BANKS_MANAGE]} feature="accounting" />}>
      <Route path="finance/banks" element={<BankManagement />} />
      <Route path="finance/treasury-accounts" element={<BankManagement />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.COA, APP_PERMISSIONS.ACCOUNTING.COA_MANAGE]} feature="accounting" />}>
      <Route path="accounting/chart-of-accounts" element={<ChartOfAccounts />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE]} feature="accounting" />}>
      <Route path="accounting/journal-entries" element={<JournalEntries />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.VOUCHER, APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE, APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE]} feature="accounting" />}>
      <Route path="accounting/vouchers" element={<FinancialVoucherList />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE]} feature="accounting" />}>
      <Route path="accounting/voucher-approvals" element={<FinancialVoucherApprovals />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE, APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE]} feature="accounting" />}>
      <Route path="accounting/vouchers/new" element={<FinancialVoucherForm />} />
      <Route path="accounting/vouchers/:id" element={<FinancialVoucherForm />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.LEDGER, APP_PERMISSIONS.ACCOUNTING.REPORTS]} feature="accounting" />}>
      <Route path="accounting/general-ledger" element={<GeneralLedger />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW, APP_PERMISSIONS.ACCOUNTING.INVESTORS]} feature="accounting" />}>
      <Route path="accounting/investors" element={<InvestorManagement />} />
      <Route path="accounting/investments" element={<InvestmentRecords />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW, APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION]} feature="accounting" />}>
      <Route path="accounting/profit-distribution" element={<ProfitDistribution />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW, APP_PERMISSIONS.ACCOUNTING.LOANS]} feature="accounting" />}>
      <Route path="accounting/loans" element={<LoanManagement />} />
      <Route path="accounting/loan-repayments" element={<LoanRepayments />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.REPORTS]} feature="accounting" />}>
      <Route path="accounting/tax-config" element={<AcctTaxConfiguration />} />
      <Route path="accounting/reports" element={<FinancialReports />} />
      <Route path="accounting/daily-reports" element={<DailyAccountingReports />} />
      <Route path="finance/bank-reports" element={<BankTreasuryReports />} />
      <Route path="accounting/receivables" element={<CustomerReceivablesControl />} />
      <Route path="accounting/event-receivables" element={<EventReceivablesControl />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.SETTINGS]} feature="accounting" />}>
      <Route path="accounting/settings" element={<AccountingSettings />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_VIEW, APP_PERMISSIONS.ACCOUNTING.PETTY_CASH_MANAGE]} feature="accounting" />}>
      <Route path="accounting/petty-cash" element={<PettyCash />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ACCOUNTING.RECON, APP_PERMISSIONS.ACCOUNTING.RECON_APPROVE]} feature="accounting" />}>
      <Route path="finance/reconciliation" element={<BankReconciliation />} />
    </Route>
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.HR.PAYROLL_READ, APP_PERMISSIONS.HR.PAYROLL_MANAGE, APP_PERMISSIONS.HR.PAYROLL_APPROVE]} feature="accounting" />}>
      <Route path="accounting/payroll" element={<PayrollRuns />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CRM_CUSTOMER_CONSOLE_PERMISSIONS} feature="crm" />}>
      <Route path="crm" element={<CustomerList />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CRM_DEALS_CONSOLE_PERMISSIONS} feature="crm" />}>
      <Route path="marketing" element={<VoucherList />} />
    </Route>
    <Route element={<PermissionRoute anyOf={CRM_CATERING_CONSOLE_PERMISSIONS} feature="crm" />}>
      <Route path="catering" element={<CateringManagement />} />
    </Route>

    {/* Reports */}
    <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.REPORTS, APP_PERMISSIONS.POS.ORDER_READ]} feature="pos" />}>
      <Route path="reports/sales" element={<PosSalesDashboard />} />
    </Route>

    {/* AI & Analytics */}
    <Route element={<PermissionRoute allOf={[APP_PERMISSIONS.POS.REPORTS, APP_PERMISSIONS.INVENTORY.READ]} feature="analytics" />}>
      <Route path="analytics/sales-forecast" element={<AiSalesForecaster />} />
      <Route path="analytics/waste" element={<WasteAnalytics />} />
    </Route>
  </>
);

// ─── Dynamic Title Manager ──────────────────────────────────────────────────
function TitleManager() {
  const location = useLocation();
  useEffect(() => {
    const updateTitle = () => {
      const path = location.pathname;
      if (path.startsWith('/nexus')) {
        document.title = 'Nexus (KOS)';
      } else if (path.startsWith('/console') || path.startsWith('/terminal')) {
        document.title = 'Console (KOS)';
      } else if (path.startsWith('/menu')) {
        document.title = 'Menu (KOS)';
      } else {
        document.title = 'KitchenOS';
      }
    };

    updateTitle();


    // Also watch for our internal nav_mode_changed event
    const handleNavChange = () => updateTitle();
    window.addEventListener('nav_mode_changed', handleNavChange);

    return () => {
      window.removeEventListener('nav_mode_changed', handleNavChange);
    };
  }, [location.pathname]);

  return null;
}

// ─── Role-Based Root Redirect ──────────────────────────────
function RootRedirect() {
  const userType = readAuthSessionItem('user_type') || 'client';
  const tenantSlug = resolveTenantSlug(readStoredUserContext());
  if (userType === 'system') {
    return <Navigate to="/nexus" replace />;
  }
  return <Navigate to={tenantSlug ? `/console/${tenantSlug}` : '/console/access-required'} replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────
class PosRouteErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string; componentStack: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '', componentStack: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? (error.message || 'Unknown runtime error') : String(error || 'Unknown runtime error'),
    };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    console.error('POS terminal render error:', error);
    this.setState({
      errorMessage: error instanceof Error ? (error.message || 'Unknown runtime error') : String(error || 'Unknown runtime error'),
      componentStack: String(info?.componentStack || '').trim(),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '24px' }}>
          <div style={{ width: 'min(560px, 100%)', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' }}>
            <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>POS screen could not finish rendering</h2>
            <p style={{ margin: '0 0 16px', color: '#475569', lineHeight: 1.5 }}>
              The POS route hit a runtime error while rendering. Reload the screen and retry the last action.
            </p>
            {this.state.errorMessage ? (
              <div style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Runtime Error</strong>
                {this.state.errorMessage}
              </div>
            ) : null}
            {this.state.componentStack ? (
              <div style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Component Stack</strong>
                {this.state.componentStack}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => window.location.reload()} style={{ border: 'none', borderRadius: '10px', background: '#0f766e', color: '#fff', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
                Reload POS
              </button>
              <button type="button" onClick={() => { window.location.href = '/terminal'; }} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', background: '#fff', color: '#0f172a', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
                Go To Terminal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ThemeProvider>
      <KitchenToastContainer />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <TitleManager />
          <Routes>
            {/*
              Portal Access Map:
              - System Portal (/admin-login) -> pages/platform/PlatformDashboard.tsx
              - Client Portal (/client-login) -> pages/client-portal/MasterSetup.tsx
              - Branch Portal (/login)        -> pages/bmDashboard.tsx
              - Customer Portal (/customer-login) -> pages/customers/CustomerList.tsx
            */}
            {/* ─── Role-Based Root Redirect ────────────────────────────── */}
            <Route path="/" element={<RootRedirect />} />

            {/* ─── Auth Namespaces ───────────────────────────────────────── */}
            <Route path="/console/auth" element={<Navigate to="/console/access-required" replace />} />
            <Route path="/nexus/auth" element={<AdminLoginPage />} />
            <Route path="/menu/auth" element={<CustomerLoginPage />} />

            <Route path="/console/:tenantSlug/auth" element={<LoginPage />} />
            <Route path="/console/access-required" element={<ConsoleSlugRequired />} />

            {/* Legacy Redirects */}
            <Route path="/login" element={<Navigate to="/console/access-required" replace />} />
            <Route path="/client-login" element={<Navigate to="/console/access-required" replace />} />
            <Route path="/admin-login" element={<Navigate to="/nexus/auth" replace />} />
            <Route path="/customer-login" element={<Navigate to="/menu/auth" replace />} />

            {/* ─── Ops Console (Unified HQ & Branch) ──────────────────────── */}
            <Route path="/console" element={<AuthGuard><AppLayout /></AuthGuard>}>
              {consoleRoutes}
            </Route>

            <Route path="/console/:tenantSlug" element={<AuthGuard><AppLayout /></AuthGuard>}>
              {consoleRoutes}
            </Route>

            {/* ─── Nexus Portal (System/Platform) ─────────────────────────── */}
            <Route path="/nexus" element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.PLATFORM.SUPER_ADMIN]} />}>
                <Route index element={<PlatformDashboard />} />
                <Route path="clients" element={<ClientManagement />} />
                <Route path="clients/new" element={<ClientEditor />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="clients/:id/edit" element={<ClientEditor />} />
                <Route path="departments" element={<Departments />} />
                <Route path="themes" element={<ThemeList />} />
                <Route path="themes/new" element={<ThemeForm />} />
                <Route path="themes/:id" element={<ThemeForm />} />
                <Route path="themes/:id/edit" element={<ThemeForm />} />
                <Route path="users" element={<SystemUserList />} />
                <Route path="users/new" element={<SystemUserEditor />} />
                <Route path="users/:id" element={<SystemUserEditor />} />
                <Route path="users/:id/edit" element={<SystemUserEditor />} />
                <Route path="security" element={<Navigate to="/nexus/security/access_control" replace />} />
                <Route path="security/access_control" element={<AccessControl />} />
                <Route path="security/permission_registry" element={<PermissionRegistry />} />
                <Route path="settings" element={<OrganizationSettings />} />
                <Route path="subscription_pack" element={<SubscriptionGroupList />} />
                <Route path="subscription_pack/new" element={<SubscriptionGroupForm />} />
                <Route path="subscription_pack/:id" element={<SubscriptionPlanDetail />} />
                <Route path="subscription_pack/:id/edit" element={<SubscriptionGroupForm />} />
                <Route path="features" element={<FeatureRegistry />} />
                <Route path="blueprints" element={<BlueprintList />} />
                <Route path="blueprints/new" element={<BlueprintForm />} />
                <Route path="blueprints/:id" element={<BlueprintDetail />} />
                <Route path="blueprints/:id/edit" element={<BlueprintForm />} />
                <Route path="onboarding" element={<OnboardingQueue />} />
                <Route path="onboarding/:clientId" element={<OnboardingWorkspace />} />
                <Route path="designations" element={<Designations />} />
                <Route path="invoices" element={<InvoiceManagement />} />
                <Route path="broadcasts" element={<AnnouncementManagement />} />
                <Route path="radar" element={<UsageRadar />} />
                <Route path="support" element={<SupportHub />} />
                <Route path="support/clients/:id" element={<SupportClient360 />} />
                <Route path="audit-logs" element={<AuditLogList />} />
                <Route path="menu/categories" element={<MenuCategories />} />
                <Route path="menu/types" element={<MenuTypes />} />
                <Route path="menu/cuisines" element={<CuisineTypes />} />
                <Route path="menu/stations" element={<PrepStations />} />
                <Route path="menu/orders" element={<OrderTypes />} />
              </Route>
            </Route>

            {/* ─── Terminal (POS) ─────────────────────────────────────────── */}
            <Route path="/terminal" element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE, APP_PERMISSIONS.POS.DAY_MANAGE, APP_PERMISSIONS.POS.SHIFT_MANAGE, APP_PERMISSIONS.POS.REPORTS, APP_PERMISSIONS.POS.KDS_READ, APP_PERMISSIONS.POS.ORDER_EDIT]} feature="pos" />}>
                <Route index element={<TerminalDashboard />} />
              </Route>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.CASHIER_CONSOLE, APP_PERMISSIONS.POS.TILL_MANAGE, APP_PERMISSIONS.POS.DAY_MANAGE, APP_PERMISSIONS.POS.SHIFT_MANAGE, APP_PERMISSIONS.POS.ORDER_EDIT]} feature="pos" />}>
                <Route path="pos" element={<PosRouteErrorBoundary><PosTerminal /></PosRouteErrorBoundary>} />
              </Route>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.ORDER_READ, APP_PERMISSIONS.POS.ORDER_CREATE, APP_PERMISSIONS.CRM.CUSTOMERS, APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE]} feature="crm" />}>
                <Route path="customers" element={<CustomerList />} />
              </Route>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.ADMIN.SETUP_COUNTERS, APP_PERMISSIONS.POS.TILL_MANAGE]} feature="pos" />}>
                <Route path="center" element={<TerminalCenter />} />
                <Route path="till" element={<Navigate to="/terminal/center?tab=status" replace />} />
                <Route path="till-management" element={<Navigate to="/terminal/center?tab=status" replace />} />
              </Route>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.KDS_READ]} feature="pos" />}>
                <Route path="kds" element={<KitchenDisplay />} />
              </Route>
              <Route element={<PermissionRoute anyOf={[APP_PERMISSIONS.POS.DAY_MANAGE, APP_PERMISSIONS.POS.SHIFT_MANAGE, APP_PERMISSIONS.POS.TILL_MANAGE]} feature="pos" />}>
                <Route path="day" element={<BranchDayManagement />} />
              </Route>
              <Route element={<PermissionRoute anyOf={ACCOUNT_SELF_SERVICE_PERMISSIONS} />}>
                <Route path="account" element={<MyAccountPage />} />
                <Route path="profile" element={<Navigate to="/terminal/account" replace />} />
                <Route path="settings/password" element={<Navigate to="/terminal/account?tab=security" replace />} />
              </Route>
            </Route>

            {/* ─── Guest/Customer Portal ───────────────────────────────────── */}
            <Route path="/menu" element={<CustomerList />} />

            {/* Core / Dev / Misc */}
            <Route path="/design-system" element={<DesignSystemPreview />} />

            {/* ─── Bare-path Redirects ──────────────────────────────────────── */}
            {/* Components that hardcode '/products', '/recipes' etc. instead of  */}
            {/* using consoleBase are redirected here to their /console equivalents */}
            <Route path="/pos" element={<Navigate to="/terminal" replace />} />
            <Route path="/pos/terminal" element={<Navigate to="/terminal" replace />} />
            <Route path="/pos/kds" element={<Navigate to="/terminal/kds" replace />} />
            <Route path="/pos/shift" element={<Navigate to="/terminal/day" replace />} />
            <Route path="/pos/customers" element={<Navigate to="/terminal/customers" replace />} />
            <Route path="/pos/sales" element={<ConsolePathRedirect />} />

            <Route path="/products" element={<ConsolePathRedirect />} />
            <Route path="/products/*" element={<ConsolePathRedirect />} />
            <Route path="/recipes" element={<ConsolePathRedirect />} />
            <Route path="/recipes/*" element={<ConsolePathRedirect />} />
            <Route path="/inventory/*" element={<ConsolePathRedirect />} />
            <Route path="/setup/*" element={<ConsolePathRedirect />} />
            <Route path="/staff/*" element={<ConsolePathRedirect />} />
            <Route path="/production/*" element={<ConsolePathRedirect />} />
            <Route path="/purchase-orders/*" element={<ConsolePathRedirect />} />
            <Route path="/accounting/*" element={<ConsolePathRedirect />} />

            {/* 404 */}
            <Route path="*" element={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <h1 style={{ fontSize: '4rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>404</h1>
                  <h2 style={{ opacity: 0.8 }}>Page Not Found</h2>
                  <p style={{ marginTop: '1rem', opacity: 0.6 }}>The resource you are looking for does not exist or has been moved.</p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="kitchen-button-secondary"
                    style={{ marginTop: '2rem', padding: '10px 24px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', color: 'inherit' }}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
