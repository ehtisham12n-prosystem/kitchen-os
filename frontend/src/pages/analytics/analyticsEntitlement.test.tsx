import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardHome } from '../dashboard/DashboardHome';
import { AiSalesForecaster } from './AiSalesForecaster';
import { WasteAnalytics } from './WasteAnalytics';
import { BranchDashboards } from './BranchDashboards';
import { MultiBranchAnalytics } from './MultiBranchAnalytics';

const entitlementMessage = 'Your subscription does not include analytics reporting.';

const { analyticsApiMock, toastErrorMock } = vi.hoisted(() => ({
    analyticsApiMock: {
        getOperationsBranchOptions: vi.fn(),
        getManagementKpis: vi.fn(),
        getRecommendationOverview: vi.fn(),
        getSalesForecast: vi.fn(),
        getWasteAnalysis: vi.fn(),
        getBranchManagementSnapshot: vi.fn(),
        getOperationsOverview: vi.fn(),
        getOperationsBranchDetail: vi.fn(),
    },
    toastErrorMock: vi.fn(),
}));

vi.mock('../../api/api', () => ({
    analyticsApi: analyticsApiMock,
}));

vi.mock('../../components/ui/KitchenToast/toast', () => ({
    toast: {
        error: toastErrorMock,
    },
}));

vi.mock('../../hooks/useCurrencyConfig', () => ({
    useCurrencyConfig: () => ({
        formatMoney: (value: number) => `$${Number(value || 0).toFixed(2)}`,
    }),
}));

vi.mock('../../hooks/usePermissionAccess', () => ({
    usePermissionAccess: () => ({
        canViewPosReports: true,
        canReadInventory: true,
        canReadCatalog: true,
        canViewPurchaseOrders: true,
        canAccessAdminControls: true,
        canReadStaff: true,
        canViewCustomers: true,
        canViewDeals: true,
        canReadAccounting: true,
        activeBranchId: 1,
        userContext: {
            username: 'analytics.admin',
            organization_user_type: 'Admin',
        },
        canAccessBranch: () => true,
    }),
}));

function renderWithRouter(node: React.ReactNode, route = '/console/dashboard') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            {node}
        </MemoryRouter>,
    );
}

describe('analytics entitlement blocks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        analyticsApiMock.getOperationsBranchOptions.mockRejectedValue(new Error(entitlementMessage));
    });

    it('renders blocked executive dashboard state without toast spam', async () => {
        renderWithRouter(<DashboardHome />);

        expect(await screen.findByText('Executive analytics is not available for this tenant.')).toBeInTheDocument();
        expect(screen.getByText(entitlementMessage)).toBeInTheDocument();
        await waitFor(() => expect(toastErrorMock).not.toHaveBeenCalled());
    });

    it('renders blocked sales forecasting state without toast spam', async () => {
        renderWithRouter(<AiSalesForecaster />, '/console/analytics/sales-forecast');

        expect(await screen.findByText(entitlementMessage)).toBeInTheDocument();
        await waitFor(() => expect(toastErrorMock).not.toHaveBeenCalled());
        expect(analyticsApiMock.getSalesForecast).not.toHaveBeenCalled();
    });

    it('renders blocked waste analytics state without toast spam', async () => {
        renderWithRouter(<WasteAnalytics />, '/console/analytics/waste');

        expect(await screen.findByText(entitlementMessage)).toBeInTheDocument();
        await waitFor(() => expect(toastErrorMock).not.toHaveBeenCalled());
        expect(analyticsApiMock.getWasteAnalysis).not.toHaveBeenCalled();
    });

    it('renders blocked branch dashboard state without toast spam', async () => {
        renderWithRouter(<BranchDashboards />, '/console/bm-dashboard');

        expect(await screen.findByText('Branch analytics is not available for this tenant.')).toBeInTheDocument();
        expect(screen.getByText(entitlementMessage)).toBeInTheDocument();
        await waitFor(() => expect(toastErrorMock).not.toHaveBeenCalled());
        expect(analyticsApiMock.getBranchManagementSnapshot).not.toHaveBeenCalled();
    });

    it('renders blocked multi-branch analytics state without toast spam', async () => {
        renderWithRouter(<MultiBranchAnalytics />, '/console/admin/analytics');

        expect(await screen.findByText('Operational comparison across branches')).toBeInTheDocument();
        expect(screen.getByText(entitlementMessage)).toBeInTheDocument();
        await waitFor(() => expect(toastErrorMock).not.toHaveBeenCalled());
    });
});

describe('analytics success paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        analyticsApiMock.getOperationsBranchOptions.mockResolvedValue({
            branches: [
                { branch_id: 1, branch_name: 'Downtown', branch_code: 'DT' },
                { branch_id: 2, branch_name: 'Marina', branch_code: 'MR' },
            ],
            sales_categories: [{ id: 10, name: 'Beverages' }],
            inventory_classes: [{ id: 20, name: 'Dry Goods' }],
        });
    });

    it('renders executive dashboard KPIs and recommendation summary from live analytics data', async () => {
        analyticsApiMock.getManagementKpis.mockResolvedValue({
            summary_cards: {
                total_revenue: 12500,
                completed_orders: 84,
                average_order_value: 148.8,
                estimated_gross_margin_pct: 32.5,
                estimated_gross_margin: 4062.5,
                inventory_pressure: 3,
                open_shifts: 2,
            },
            trend_summary: {
                delta_pct: 8.4,
            },
            branch_rankings: {
                revenue: [
                    { branch_id: 1, branch_name: 'Downtown', completed_orders: 44, total_revenue: 7000 },
                ],
                inventory_pressure: [
                    { branch_id: 1, branch_name: 'Downtown', low_stock_count: 2, out_of_stock_count: 1, negative_stock_count: 0, pressure_count: 3 },
                ],
            },
            revenue_series: [
                { business_date: '2026-04-25', total_revenue: 1500, completed_orders: 10 },
                { business_date: '2026-04-26', total_revenue: 1700, completed_orders: 12 },
                { business_date: '2026-04-27', total_revenue: 1900, completed_orders: 14 },
            ],
            attention: {
                exceptions: [],
            },
        });
        analyticsApiMock.getRecommendationOverview.mockResolvedValue({
            summary: {
                actionable_reorders: 4,
                slow_movers: 2,
            },
            anomalies: [
                { title: 'Demand spike', message: 'Weekend burger demand is rising.', severity: 'warn' },
            ],
        });

        renderWithRouter(<DashboardHome />);

        expect(await screen.findByText('Organization Dashboard')).toBeInTheDocument();
        expect(screen.getByText('$12500.00')).toBeInTheDocument();
        expect(screen.getByText('84 completed orders')).toBeInTheDocument();
        expect(screen.getByText('Actionable reorders')).toBeInTheDocument();
        expect(screen.getByText('Weekend burger demand is rising.')).toBeInTheDocument();
        expect(analyticsApiMock.getManagementKpis).toHaveBeenCalledTimes(1);
        expect(analyticsApiMock.getRecommendationOverview).toHaveBeenCalledWith(1);
        expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it('renders branch dashboard metrics and top products from live analytics data', async () => {
        analyticsApiMock.getBranchManagementSnapshot.mockResolvedValue({
            cards: {
                total_revenue: 5600,
                completed_orders: 38,
                average_order_value: 147.37,
                open_orders: 5,
            },
            trend_summary: {
                delta_pct: 5.2,
            },
            top_products: [
                { product_name: 'Zinger Burger', quantity_sold: 23, revenue: 3450 },
            ],
            operational_health: {
                waste_level: 3.4,
                profitability_note: 'Healthy margin with manageable waste.',
            },
        });

        renderWithRouter(<BranchDashboards />, '/console/bm-dashboard');

        expect(await screen.findByText('Branch Analytics')).toBeInTheDocument();
        expect(screen.getByText(/Rs\. 5,600/)).toBeInTheDocument();
        expect(screen.getByText('Zinger Burger')).toBeInTheDocument();
        expect(screen.getByText('Healthy margin with manageable waste.')).toBeInTheDocument();
        expect(analyticsApiMock.getBranchManagementSnapshot).toHaveBeenCalledWith(1, expect.objectContaining({
            date_from: expect.any(String),
            date_to: expect.any(String),
        }));
        expect(toastErrorMock).not.toHaveBeenCalled();
    });

    it('renders multi-branch reporting summary and branch drill-down from live analytics data', async () => {
        analyticsApiMock.getOperationsOverview.mockResolvedValue({
            access_scope: {
                filtered_branch_count: 2,
                authorized_branch_count: 2,
            },
            date_range: {
                label: 'Last 30 days',
            },
            sales_summary: {
                total_revenue: 18000,
                completed_orders: 120,
            },
            profitability_summary: {
                available: true,
                estimated_gross_margin: 5400,
                estimated_gross_margin_pct: 30,
            },
            procurement_summary: {
                purchase_value: 7200,
                purchase_orders_in_period: 9,
            },
            movement_summary: {
                wastage_cost: 280,
                adjustment_event_count: 4,
            },
            filters_applied: {
                metric_scope_notes: [],
            },
            branches: [
                {
                    branch_id: 1,
                    branch_name: 'Downtown',
                    branch_code: 'DT',
                    sales: { total_revenue: 10000, completed_orders: 70, average_order_value: 142.85 },
                    inventory: { low_stock_count: 2, out_of_stock_count: 0, on_hand_quantity: 500, negative_stock_count: 0 },
                    procurement: { pending_requests: 1, pending_approval_purchase_orders: 1, awaiting_receipt_purchase_orders: 0, purchase_value: 4200 },
                    inventory_movements: { wastage_cost: 120, adjustment_event_count: 2 },
                    profitability: { available: true, estimated_gross_margin: 3000, estimated_gross_margin_pct: 30 },
                },
                {
                    branch_id: 2,
                    branch_name: 'Marina',
                    branch_code: 'MR',
                    sales: { total_revenue: 8000, completed_orders: 50, average_order_value: 160 },
                    inventory: { low_stock_count: 1, out_of_stock_count: 1, on_hand_quantity: 380, negative_stock_count: 0 },
                    procurement: { pending_requests: 0, pending_approval_purchase_orders: 1, awaiting_receipt_purchase_orders: 1, purchase_value: 3000 },
                    inventory_movements: { wastage_cost: 160, adjustment_event_count: 2 },
                    profitability: { available: true, estimated_gross_margin: 2400, estimated_gross_margin_pct: 30 },
                },
            ],
            exceptions: [],
            exports: {
                branch_summary_rows: [],
            },
        });
        analyticsApiMock.getOperationsBranchDetail.mockResolvedValue({
            sales: {
                total_revenue: 10000,
                completed_orders: 70,
                average_order_value: 142.85,
                open_orders: 4,
            },
            inventory: {
                enabled_item_count: 120,
                on_hand_quantity: 500,
                low_stock_count: 2,
                out_of_stock_count: 0,
                negative_stock_count: 0,
            },
            procurement: {
                requests_raised: 3,
                purchase_value: 4200,
            },
            inventory_movements: {
                wastage_cost: 120,
                adjustment_cost_impact: 35,
            },
            transfers: {
                incoming_open_count: 1,
                outgoing_open_count: 0,
                bottleneck_count: 0,
            },
            profitability: {
                available: true,
                estimated_gross_margin: 3000,
                estimated_gross_margin_pct: 30,
            },
            top_items: [
                { product_id: 11, product_name: 'Zinger Burger', category_name: 'Burgers', quantity_sold: 23, revenue: 3450 },
            ],
            sales_by_category: [],
            inventory_by_class: [],
            recent_inventory_movements: [],
            procurement_attention: [],
            transfer_watchlist: [],
            exports: {
                sales_top_item_rows: [],
                inventory_movement_rows: [],
            },
        });

        renderWithRouter(<MultiBranchAnalytics />, '/console/admin/analytics');

        expect(await screen.findByText('Operational comparison across branches')).toBeInTheDocument();
        expect(screen.getByText('2 / 2 branches in scope')).toBeInTheDocument();
        expect(screen.getAllByText('Downtown').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Marina').length).toBeGreaterThan(0);
        expect(await screen.findByText('Zinger Burger')).toBeInTheDocument();
        expect(analyticsApiMock.getOperationsOverview).toHaveBeenCalledTimes(1);
        expect(analyticsApiMock.getOperationsBranchDetail).toHaveBeenCalledWith(1, expect.objectContaining({
            date_from: expect.any(String),
            date_to: expect.any(String),
        }));
        expect(toastErrorMock).not.toHaveBeenCalled();
    });
});
