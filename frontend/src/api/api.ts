/* eslint-disable @typescript-eslint/no-explicit-any */
export { API_BASE_URL, API_PUBLIC_BASE_URL, apiUrl, apiAssetUrl } from '../config/runtime';
import { apiUrl } from '../config/runtime';
import { clearAuthSession, hydrateAuthSession, readAuthSessionItem } from '../auth/storage';

type ActiveBranchContext = {
    id?: number;
    branch_id: number;
    branch_name: string | null;
    is_primary: boolean;
    role_id: number | null;
    role_name: string | null;
    [key: string]: unknown;
};

type AuthUserContext = {
    user_type?: string;
    type?: string;
    is_system?: boolean;
    allowed_branches?: ActiveBranchContext[];
    [key: string]: unknown;
};

export function resolveActiveBranchId(): string | null {
    const explicit = localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id');
    if (explicit) return explicit;
    try {
        const raw = readAuthSessionItem('user_context');
        const ctx = (raw ? JSON.parse(raw) : null) as AuthUserContext | null;
        const branches = ctx?.allowed_branches ?? [];
        const primary = branches.find((branch) => branch.is_primary) || branches[0];
        return primary?.branch_id ? String(primary.branch_id) : null;
    } catch {
        return null;
    }
}

type ApiRequestOptions = RequestInit & {
    skipBranchContext?: boolean;
};

function toApiError(error: unknown): Error {
    if (error instanceof Error) {
        const normalized = error.message.trim().toLowerCase();
        if (
            normalized === 'failed to fetch'
            || normalized.includes('load failed')
            || normalized.includes('networkerror')
        ) {
            return new Error('Unable to reach the KitchenOS API. Please confirm the backend is running on http://127.0.0.1:3000.');
        }

        return error;
    }

    return new Error('An unexpected network error occurred.');
}

function formatReferenceSuffix(requestId?: string | null): string {
    return requestId ? ` Reference ID: ${requestId}.` : '';
}

function formatFieldLabel(raw: string): string {
    return raw
        .replace(/^property\s+/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .trim();
}

function normalizeApiMessage(
    message: string,
    details: string[],
    requestId?: string | null,
): string {
    const text = message.trim();

    if (/^An unexpected operational error occurred\.?$/i.test(text)) {
        return `KitchenOS could not complete this action right now. Please reload the order and try again.${formatReferenceSuffix(requestId)}`;
    }

    const checkoutStageMatch = text.match(/^Checkout failed while (.+?):\s*(.+)$/i);
    if (checkoutStageMatch) {
        const stage = checkoutStageMatch[1].trim().toLowerCase();
        const rawCause = checkoutStageMatch[2].trim();

        if (/column 'order_id' cannot be null/i.test(rawCause)) {
            return `This order could not be finalized because its saved payment record is incomplete. Reload the order and try again. If the issue continues, contact the administrator.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('payment transactions')) {
            return `KitchenOS could not save the payment lines for this checkout. Please reload the order and try again.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('tax and charge')) {
            return `KitchenOS could not apply tax or service charges for this checkout. Please review the bill and try again.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('final order totals')) {
            return `KitchenOS could not save the final order totals. Please reload the order and try again.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('voucher')) {
            return `KitchenOS could not apply the voucher during checkout. Please remove the voucher or retry.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('customer loyalty')) {
            return `Payment was blocked while updating customer loyalty. Please retry after reloading the order.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('inventory')) {
            return `Payment was blocked while updating inventory for this order. Please contact the manager and retry.${formatReferenceSuffix(requestId)}`;
        }
        if (stage.includes('accounting')) {
            return `Payment was blocked while posting this sale to accounts. Please retry in a moment.${formatReferenceSuffix(requestId)}`;
        }

        return `KitchenOS could not complete checkout while ${checkoutStageMatch[1].trim()}. Please retry.${formatReferenceSuffix(requestId)}`;
    }

    if (/^Unauthorized$/i.test(text)) {
        return `Your session could not be validated for this workspace. Please sign in again.${formatReferenceSuffix(requestId)}`;
    }

    if (/^Forbidden$/i.test(text)) {
        return `You do not have permission to access this workspace.${formatReferenceSuffix(requestId)}`;
    }

    const branchLimitMatch = text.match(/^Branch limit reached \((\d+)\)\.?$/i);
    if (branchLimitMatch) {
        return `You have reached the maximum number of branches allowed on your current plan. This plan allows up to ${branchLimitMatch[1]} branch${branchLimitMatch[1] === '1' ? '' : 'es'}.${formatReferenceSuffix(requestId)}`;
    }

    const userLimitMatch = text.match(/^Active user limit reached \((\d+)\)\.?$/i);
    if (userLimitMatch) {
        return `You have reached the maximum number of active users allowed on your current plan. This plan allows up to ${userLimitMatch[1]} active user${userLimitMatch[1] === '1' ? '' : 's'}.${formatReferenceSuffix(requestId)}`;
    }

    const posDeviceLimitMatch = text.match(/^POS device limit reached \((\d+)\)\.?$/i);
    if (posDeviceLimitMatch) {
        return `You have reached the maximum number of POS devices allowed on your current plan. This plan allows up to ${posDeviceLimitMatch[1]} device${posDeviceLimitMatch[1] === '1' ? '' : 's'}.${formatReferenceSuffix(requestId)}`;
    }

    if (/^Email already registered\.?$/i.test(text)) {
        return `This email address is already in use. Please use a different email address.${formatReferenceSuffix(requestId)}`;
    }

    const ownershipMatch = text.match(/^(Role|Department|Designation|Branch) (\d+) does not belong to your organization\.?$/i);
    if (ownershipMatch) {
        return `The selected ${ownershipMatch[1].toLowerCase()} is not available for your organization.${formatReferenceSuffix(requestId)}`;
    }

    const scopeMatch = text.match(/^Branch (\d+) is outside your allowed scope\.?$/i);
    if (scopeMatch) {
        return `You do not have permission to use the selected branch for this action.${formatReferenceSuffix(requestId)}`;
    }

    const branchAccessMatch = text.match(/^You do not have access to branch #(\d+)\.?$/i);
    if (branchAccessMatch) {
        return `Your current branch session is out of date. Switch to an assigned branch and try again.${formatReferenceSuffix(requestId)}`;
    }

    const branchReadinessMatch = text.match(/^Branch is not ready for active use:\s*(.+)$/i);
    if (branchReadinessMatch) {
        const blocker = branchReadinessMatch[1].trim();
        if (/default branch tax code/i.test(blocker)) {
            return `This branch cannot be activated yet because a default tax code has not been configured. Please add a default tax code in Branch Settings and try again.${formatReferenceSuffix(requestId)}`;
        }

        return `This branch cannot be activated yet. ${blocker}${formatReferenceSuffix(requestId)}`;
    }

    if (details.length > 0) {
        const translatedDetails = details.map((detail) => {
            const normalized = detail.trim();
            if (normalized.toLowerCase().includes('should not be empty')) {
                return `${formatFieldLabel(normalized.split(' should')[0])} is required.`;
            }
            if (normalized.toLowerCase().includes('must be an email')) {
                return `${formatFieldLabel(normalized.split(' must')[0])} must be a valid email address.`;
            }
            if (normalized.toLowerCase().includes('must be a url address')) {
                return `${formatFieldLabel(normalized.split(' must')[0])} must be a valid web address.`;
            }
            if (normalized.toLowerCase().includes('must be a number')) {
                return `${formatFieldLabel(normalized.split(' must')[0])} must be a number.`;
            }
            return normalized;
        });
        return `${translatedDetails.join(' ')}${formatReferenceSuffix(requestId)}`;
    }

    return `${text}${formatReferenceSuffix(requestId)}`;
}

export async function request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    hydrateAuthSession();
    const token = readAuthSessionItem('access_token');
    const activeBranchId = resolveActiveBranchId();
    const {
        skipBranchContext = false,
        headers: requestHeaders,
        ...requestOptions
    } = options;

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        // Auto-inject active branch context for the backend BranchAccessGuard
        ...(!skipBranchContext && activeBranchId ? { 'x-branch-id': activeBranchId } : {}),
        ...requestHeaders,
    };

    let response: Response;
    try {
        response = await fetch(apiUrl(endpoint), { ...requestOptions, headers });
    } catch (error) {
        throw toApiError(error);
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        const requestId = error?.request_id || error?.error?.request_id || null;
        const details = Array.isArray(error?.error?.details) ? error.error.details.filter(Boolean) : [];
        const message = error?.error?.message || error?.message || response.statusText;
        const isLoginEndpoint = endpoint === '/auth/system-login'
            || endpoint === '/auth/client-login'
            || endpoint === '/auth/customer-login';
        if (response.status === 401 && !isLoginEndpoint) {
            clearAuthSession();
            throw new Error('Your session has expired. Please sign in again.');
        }
        const finalMessage = normalizeApiMessage(message, details, requestId);
        throw new Error(finalMessage);
    }

    return response.json();
}

async function uploadFileRequest<T>(endpoint: string, fieldName: string, file: File): Promise<T> {
    hydrateAuthSession();
    const token = readAuthSessionItem('access_token');
    const formData = new FormData();
    formData.append(fieldName, file);

    let response: Response;
    try {
        response = await fetch(apiUrl(endpoint), {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: formData,
        });
    } catch (error) {
        throw toApiError(error);
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error?.error?.message || error?.message || 'Upload failed');
    }

    return response.json();
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
    const qs = new URLSearchParams(
        Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)]),
    ).toString();

    return qs ? `?${qs}` : '';
}

function requestForBranch<T>(
    endpoint: string,
    branchId?: string | number | null,
    options: RequestInit = {},
): Promise<T> {
    const branchHeaders: Record<string, string> = {};
    if (branchId) {
        branchHeaders['x-branch-id'] = String(branchId);
    }
    const optionHeaders = (options.headers ?? {}) as Record<string, string>;
    const headers: HeadersInit = {
        ...optionHeaders,
        ...branchHeaders,
    };
    return request<T>(endpoint, {
        ...options,
        headers,
    });
}

function withoutBranchId<T extends Record<string, any> | undefined | null>(data: T): Record<string, any> {
    if (!data) return {};
    const { branch_id: _branchId, ...payload } = data;
    return payload;
}

export const inventoryApi = {
    getHierarchy: () => request<any[]>('/inventory/hierarchy'),
    getFilterHierarchy: () => request<any[]>('/inventory/filter-hierarchy'),
    createClass: (data: any) => request('/inventory/classes', { method: 'POST', body: JSON.stringify(data) }),
    updateClass: (id: number, data: any) => request(`/inventory/classes/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteClass: (id: number) => request(`/inventory/classes/${id}/delete`, { method: 'POST' }),
    createType: (classId: number, data: any) => request(`/inventory/classes/${classId}/types`, { method: 'POST', body: JSON.stringify(data) }),
    updateType: (id: number, data: any) => request(`/inventory/types/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteType: (id: number) => request(`/inventory/types/${id}/delete`, { method: 'POST' }),
    createSubType: (typeId: number, data: any) => request(`/inventory/types/${typeId}/subtypes`, { method: 'POST', body: JSON.stringify(data) }),
    updateSubType: (id: number, data: any) => request(`/inventory/subtypes/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteSubType: (id: number) => request(`/inventory/subtypes/${id}/delete`, { method: 'POST' }),
    createItem: (subTypeId: number, data: any) => request(`/inventory/subtypes/${subTypeId}/items`, { method: 'POST', body: JSON.stringify(data) }),
    updateItem: (id: number, data: any) => request(`/inventory/items/${id}`, { method: 'POST', body: JSON.stringify(data) }),
    deleteItem: (id: number) => request(`/inventory/items/${id}/delete`, { method: 'POST' }),
    getBranchMaster: (params: Record<string, string | number | undefined>) => {
        const qs = new URLSearchParams(
            Object.entries(params)
                .filter(([, value]) => value !== undefined && value !== null && value !== '')
                .map(([key, value]) => [key, String(value)]),
        ).toString();
        const branchId = params.branchId ?? params.branch_id;
        return requestForBranch<any>(
            `/inventory/branch-master${qs ? `?${qs}` : ''}`,
            branchId ? String(branchId) : undefined,
        );
    },
    toggleBranchItem: (itemId: number, branchId: number, enabled: boolean) =>
        request(`/inventory/branch-toggle/${itemId}?branchId=${branchId}`, { method: 'POST', body: JSON.stringify({ enabled }) }),
    updateBranchStockLevels: (itemId: number, branchId: number, min: number, max: number) =>
        request(`/inventory/branch-stock/${itemId}?branchId=${branchId}`, { method: 'POST', body: JSON.stringify({ min, max }) }),
    getItemRequests: (status?: string) => request<any[]>(`/inventory/requests${status ? `?status=${status}` : ''}`),
    createItemRequest: (data: any) => request('/inventory/requests', { method: 'POST', body: JSON.stringify(data) }),
    processItemRequest: (id: number, data: any) => request(`/inventory/requests/${id}/process`, { method: 'POST', body: JSON.stringify(data) }),

    // Operational
    getBranchStock: (branchId: number) => request<any[]>(`/inventory-op/branch/${branchId}`),
    getLedger: (
        branchId: number,
        params?: { itemId?: number | string | null; transactionType?: string | null; limit?: number | string | null },
    ) => request<any[]>(
        `/inventory-op/ledger/${branchId}${buildQuery({
            itemId: params?.itemId || undefined,
            transactionType: params?.transactionType || undefined,
            limit: params?.limit || undefined,
        })}`,
    ),
    getLedgerPage: (
        branchId: number,
        params?: {
            itemId?: number | string | null;
            transactionType?: string | null;
            search?: string | null;
            date_from?: string | null;
            date_to?: string | null;
            limit?: number | string | null;
            offset?: number | string | null;
        },
    ) => request<any>(
        `/inventory-op/ledger/${branchId}${buildQuery({
            itemId: params?.itemId || undefined,
            transactionType: params?.transactionType || undefined,
            search: params?.search || undefined,
            date_from: params?.date_from || undefined,
            date_to: params?.date_to || undefined,
            limit: params?.limit || undefined,
            offset: params?.offset || undefined,
            paginate: 1,
        })}`,
    ),
    getInventoryDashboard: (branchId: number) => request<any>(`/inventory-op/dashboard/${branchId}`),
    getConsumption: (branchId: number, params?: { date_from?: string; date_to?: string; source_type?: string; limit?: number }) =>
        request<any[]>(`/inventory/consumption${buildQuery({
            branch_id: branchId,
            date_from: params?.date_from,
            date_to: params?.date_to,
            source_type: params?.source_type,
            limit: params?.limit,
        })}`),
    postConsumption: (branchId: number, data: any) =>
        request<any>('/inventory/consume', {
            method: 'POST',
            body: JSON.stringify({ ...data, branch_id: branchId }),
        }),
    postWaste: (branchId: number, data: any) =>
        request<any>('/inventory/waste', {
            method: 'POST',
            body: JSON.stringify({ ...data, branch_id: branchId }),
        }),
    getVariance: (branchId: number) => request<any>(`/inventory/variance${buildQuery({ branch_id: branchId })}`),
    getBlindCountDashboard: (branchId: number) => request<any>(`/inventory-op/counts/dashboard/${branchId}`),
    getClosingDashboard: (branchId: number) => request<any>(`/inventory-op/counts/closing-dashboard/${branchId}`),
    getBlindCountSessions: (
        branchId: number,
        params?: { status?: string; count_type?: string; location_id?: number | string; business_date?: string },
    ) => request<any>(`/inventory-op/counts/branch/${branchId}${buildQuery({
        status: params?.status,
        count_type: params?.count_type,
        location_id: params?.location_id,
        business_date: params?.business_date,
    })}`),
    createBlindCountSession: (data: any) =>
        requestForBranch<any>('/inventory-op/counts', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getBlindCountSession: (id: number | string) => request<any>(`/inventory-op/counts/${id}`),
    submitBlindCountSession: (id: number | string, data: any) =>
        request<any>(`/inventory-op/counts/${id}/submit`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    reviewBlindCountSession: (id: number | string, data: any) =>
        request<any>(`/inventory-op/counts/${id}/review`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getGrns: () => request<any[]>('/inventory-op/grns'),
    getGrnsPage: (params?: {
        search?: string;
        branch_id?: number | string;
        vendor_id?: number | string;
        payable_status?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }) => request<any>(`/inventory-op/grns${buildQuery({
        search: params?.search,
        branch_id: params?.branch_id,
        vendor_id: params?.vendor_id,
        payable_status: params?.payable_status,
        date_from: params?.date_from,
        date_to: params?.date_to,
        limit: params?.limit,
        offset: params?.offset,
        paginate: 1,
    })}`),
    getGrn: (id: number | string) => request<any>(`/inventory-op/grns/${id}`),
    postGrn: (data: any) =>
        requestForBranch<any>('/inventory-op/grns', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    captureGrnBill: (id: number | string, data: any) =>
        requestForBranch<any>(`/inventory-op/grns/${id}/bill`, data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createGrnReturn: (id: number | string, data: any) =>
        requestForBranch<any>(`/inventory-op/grns/${id}/returns`, data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    issueToKitchen: (branchId: number, data: any) =>
        request<any>(`/inventory-op/issue/${branchId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    receiveStock: (data: any) =>
        requestForBranch<any>('/inventory/ops/receive', data?.branch_id ?? data?.destination_branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    receivePO: (branchId: number, poId: number) => request(`/inventory-op/receive/${branchId}/${poId}`, { method: 'POST' }),
    adjustStock: (branchId: number, data: any) => request(`/inventory-op/adjust/${branchId}`, { method: 'POST', body: JSON.stringify(data) }),
    createPO: (branchIdOrData: number | any, maybeData?: any) => {
        const data = typeof branchIdOrData === 'number'
            ? { ...(maybeData ?? {}), branch_id: maybeData?.branch_id ?? branchIdOrData }
            : branchIdOrData;
        return requestForBranch('/inventory-op/purchase-orders', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    getPurchaseOrders: () => request<any[]>('/inventory-op/purchase-orders'),
    getPurchaseOrdersPage: (params?: {
        search?: string;
        status?: string;
        approval_status?: string;
        branch_id?: number | string;
        destination_branch_id?: number | string;
        vendor_id?: number | string;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }) => request<any>(`/inventory-op/purchase-orders${buildQuery({
        search: params?.search,
        status: params?.status,
        approval_status: params?.approval_status,
        branch_id: params?.branch_id,
        destination_branch_id: params?.destination_branch_id,
        vendor_id: params?.vendor_id,
        date_from: params?.date_from,
        date_to: params?.date_to,
        limit: params?.limit,
        offset: params?.offset,
        paginate: 1,
    })}`),
    getPurchaseOrder: (id: number | string) => request<any>(`/inventory-op/purchase-orders/${id}`),
    updatePurchaseOrderStatus: (id: number | string, status: string) => request(`/inventory-op/purchase-orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    updatePurchaseOrderApproval: (id: number | string, approval_status: string, approval_notes?: string) =>
        request(`/inventory-op/purchase-orders/${id}/approval`, {
            method: 'POST',
            body: JSON.stringify({ approval_status, approval_notes }),
        }),
    deletePurchaseOrder: (id: number | string) => request(`/inventory-op/purchase-orders/${id}/delete`, { method: 'POST' }),
    getProcurementRequests: (status?: string) =>
        request<any[]>(`/inventory-op/procurement-requests${status ? `?status=${status}` : ''}`),
    getProcurementRequest: (id: number | string) =>
        request<any>(`/inventory-op/procurement-requests/${id}`),
    createProcurementRequest: (data: any) =>
        requestForBranch('/inventory-op/procurement-requests', data?.requesting_branch_id ?? data?.destination_branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    reviewProcurementRequest: (id: number | string, data: any) =>
        request(`/inventory-op/procurement-requests/${id}/review`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getTransfers: (status?: string) => request<any[]>(`/inventory-op/transfers${status ? `?status=${status}` : ''}`),
    getTransferBranchOptions: () => request<any[]>('/inventory-op/transfers/branch-options'),
    getTransfer: (id: number | string) => request<any>(`/inventory-op/transfers/${id}`),
    createTransfer: (data: any) => request('/inventory-op/transfers', { method: 'POST', body: JSON.stringify(data) }),
    approveTransfer: (id: number | string, notes?: string) =>
        request(`/inventory-op/transfers/${id}/approve`, { method: 'POST', body: JSON.stringify({ notes }) }),
    rejectTransfer: (id: number | string, notes?: string) =>
        request(`/inventory-op/transfers/${id}/reject`, { method: 'POST', body: JSON.stringify({ notes }) }),
    cancelTransfer: (id: number | string, notes?: string) =>
        request(`/inventory-op/transfers/${id}/cancel`, { method: 'POST', body: JSON.stringify({ notes }) }),
    completeTransferFinanceReview: (id: number | string, notes?: string) =>
        request(`/inventory-op/transfers/${id}/finance-review`, { method: 'POST', body: JSON.stringify({ notes }) }),
    dispatchTransfer: (id: number | string, data: any) =>
        request(`/inventory-op/transfers/${id}/dispatch`, { method: 'POST', body: JSON.stringify(data) }),
    receiveTransfer: (id: number | string, data: any) =>
        request(`/inventory-op/transfers/${id}/receive`, { method: 'POST', body: JSON.stringify(data) }),
    getProductionSupplyRequests: (status?: string) =>
        request<any[]>(`/inventory-op/production-supply${status ? `?status=${status}` : ''}`),
    getProductionSupplyBranchOptions: () =>
        request<any[]>('/inventory-op/production-supply/branch-options'),
    getProductionSupplyRequest: (id: number | string) =>
        request<any>(`/inventory-op/production-supply/${id}`),
    createProductionSupplyRequest: (data: any) =>
        request('/inventory-op/production-supply', { method: 'POST', body: JSON.stringify(data) }),
    approveProductionSupplyRequest: (id: number | string, notes?: string) =>
        request(`/inventory-op/production-supply/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ notes }),
        }),
    rejectProductionSupplyRequest: (id: number | string, notes?: string) =>
        request(`/inventory-op/production-supply/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ notes }),
        }),
    dispatchProductionSupplyRequest: (id: number | string, data: any) =>
        request(`/inventory-op/production-supply/${id}/dispatch`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    receiveProductionSupplyRequest: (id: number | string, data: any) =>
        request(`/inventory-op/production-supply/${id}/receive`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

export const accountingApi = {
    getAccounts: () => request<any[]>('/accounting/accounts'),
    createAccount: (data: any) => request('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) }),
    updateAccount: (id: number, data: any) => request(`/accounting/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getDashboard: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/dashboard${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    getTreasuryOverview: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/treasury/overview${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    getMerchantSettlementReview: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/treasury/merchant-settlement-review${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    getTreasuryExceptionWorkflow: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/treasury/exceptions${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    upsertTreasuryException: (data: any) =>
        requestForBranch<any>('/accounting/treasury/exceptions', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createTreasuryMovement: (data: any) =>
        requestForBranch<any>('/accounting/treasury/movements', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createMerchantSettlement: (data: any) =>
        requestForBranch<any>('/accounting/treasury/merchant-settlements', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createInternalServiceRecharge: (data: any) =>
        requestForBranch<any>('/accounting/inter-branch-service-recharges', data?.source_branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getFixedAssetRegister: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/fixed-assets${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    createFixedAssetItem: (data: any) =>
        request<any>('/accounting/fixed-assets/items', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateFixedAssetItem: (id: number | string, data: any) =>
        request<any>(`/accounting/fixed-assets/items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    createFixedAssetUnit: (data: any) =>
        requestForBranch<any>('/accounting/fixed-assets/units', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateFixedAssetUnit: (id: number | string, data: any) =>
        request<any>(`/accounting/fixed-assets/units/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    issueFixedAssetUnit: (id: number | string, data: any) =>
        requestForBranch<any>(`/accounting/fixed-assets/units/${id}/issue`, data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    returnFixedAssetUnit: (id: number | string, data: any) =>
        request<any>(`/accounting/fixed-assets/units/${id}/return`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    transferFixedAssetUnit: (id: number | string, data: any) =>
        request<any>(`/accounting/fixed-assets/units/${id}/transfer`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    disposeFixedAssetUnit: (id: number | string, data: any) =>
        requestForBranch<any>(`/accounting/fixed-assets/units/${id}/dispose`, data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getPeriodLock: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/settings/period-lock${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    updatePeriodLock: (data: any) =>
        requestForBranch<any>('/accounting/settings/period-lock', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getMonthCloseChecklist: (params?: { branch_id?: string | number | null; period_key?: string }) =>
        requestForBranch<any>(
            `/accounting/settings/month-close-checklist${buildQuery({
                branch_id: params?.branch_id || undefined,
                period_key: params?.period_key,
            })}`,
            params?.branch_id,
        ),
    updateMonthCloseChecklistItem: (data: any) =>
        requestForBranch<any>('/accounting/settings/month-close-checklist', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    finalizeYearEnd: (data: any) =>
        requestForBranch<any>('/accounting/settings/year-end/finalize', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    reopenYearEnd: (data: any) =>
        requestForBranch<any>('/accounting/settings/year-end/reopen', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getJournalEntries: (params?: { branch_id?: string | number | null; business_date?: string; date_from?: string; date_to?: string }) =>
        requestForBranch<any[]>(
            `/accounting/journal${buildQuery({
                branch_id: params?.branch_id || undefined,
                business_date: params?.business_date,
                date_from: params?.date_from,
                date_to: params?.date_to,
            })}`,
            params?.branch_id,
        ),
    getJournalEntry: (id: number | string) => request<any>(`/accounting/journal/${id}`),
    reverseJournalEntry: (id: number | string, data: any) =>
        requestForBranch<any>(`/accounting/journal/${id}/reverse`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    createJournalEntry: (data: any) =>
        requestForBranch('/accounting/journal', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    getTrialBalance: (params?: { branch_id?: string | number | null; as_of_date?: string }) =>
        requestForBranch<any>(
            `/accounting/trial-balance${buildQuery({
                branch_id: params?.branch_id || undefined,
                as_of_date: params?.as_of_date,
            })}`,
            params?.branch_id,
        ),
    getPL: (params?: { branch_id?: string | number | null; date_from?: string; date_to?: string }) =>
        requestForBranch<any>(
            `/accounting/reports/profit-and-loss${buildQuery({
                branch_id: params?.branch_id || undefined,
                date_from: params?.date_from,
                date_to: params?.date_to,
            })}`,
            params?.branch_id,
        ),
    getBalanceSheet: (params?: { branch_id?: string | number | null; as_of_date?: string }) =>
        requestForBranch<any>(
            `/accounting/reports/balance-sheet${buildQuery({
                branch_id: params?.branch_id || undefined,
                as_of_date: params?.as_of_date,
            })}`,
            params?.branch_id,
        ),
    getCashFlow: (params?: { branch_id?: string | number | null; date_from?: string; date_to?: string }) =>
        requestForBranch<any>(
            `/accounting/reports/cash-flow${buildQuery({
                branch_id: params?.branch_id || undefined,
                date_from: params?.date_from,
                date_to: params?.date_to,
            })}`,
            params?.branch_id,
        ),
    getReceivablesAging: (params?: { branch_id?: string | number | null; as_of_date?: string; customer_id?: string | number | null; source_type?: string | null }) =>
        requestForBranch<any>(
            `/accounting/reports/receivables-aging${buildQuery({
                branch_id: params?.branch_id || undefined,
                as_of_date: params?.as_of_date,
                customer_id: params?.customer_id || undefined,
                source_type: params?.source_type || undefined,
            })}`,
            params?.branch_id,
        ),
    getPayablesAging: (params?: { branch_id?: string | number | null; as_of_date?: string; vendor_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/reports/payables-aging${buildQuery({
                branch_id: params?.branch_id || undefined,
                as_of_date: params?.as_of_date,
                vendor_id: params?.vendor_id || undefined,
            })}`,
            params?.branch_id,
        ),
    getPayableDocumentDetail: (sourceType: 'grn' | 'expense_voucher', id: number | string) => request<any>(`/accounting/reports/payables-aging/${sourceType}/${id}`),
    getPaymentVoucherExceptions: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any>(
            `/accounting/reports/payment-voucher-exceptions${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    getPettyCashOverview: (params?: { branch_id?: string | number | null; date_from?: string; date_to?: string }) =>
        requestForBranch<any>(
            `/accounting/petty-cash${buildQuery({
                branch_id: params?.branch_id || undefined,
                date_from: params?.date_from,
                date_to: params?.date_to,
            })}`,
            params?.branch_id,
        ),
    getPayrollRuns: (params?: { branch_id?: string | number | null; period_start?: string; period_end?: string; status?: string }) =>
        requestForBranch<any>(
            `/accounting/payroll${buildQuery({
                branch_id: params?.branch_id || undefined,
                period_start: params?.period_start,
                period_end: params?.period_end,
                status: params?.status,
            })}`,
            params?.branch_id,
        ),
    getPayrollPreview: (params: { branch_id: string | number; period_start: string; period_end: string }) =>
        requestForBranch<any>(
            `/accounting/payroll/preview${buildQuery({
                branch_id: params?.branch_id,
                period_start: params?.period_start,
                period_end: params?.period_end,
            })}`,
            params?.branch_id,
        ),
    getPayrollRun: (id: number | string) => request<any>(`/accounting/payroll/${id}`),
    getPayrollRecoveryProfiles: (params: { branch_id: string | number }) =>
        requestForBranch<any>(
            `/accounting/payroll/recovery-profiles${buildQuery({
                branch_id: params?.branch_id,
            })}`,
            params?.branch_id,
        ),
    getPayrollComplianceSetting: (params: { branch_id: string | number }) =>
        requestForBranch<any>(
            `/accounting/payroll/compliance-settings${buildQuery({
                branch_id: params?.branch_id,
            })}`,
            params?.branch_id,
        ),
    getPayrollComplianceReview: (params: { branch_id: string | number }) =>
        requestForBranch<any>(
            `/accounting/payroll/compliance-review${buildQuery({
                branch_id: params?.branch_id,
            })}`,
            params?.branch_id,
        ),
    getPayrollComplianceFilings: (params: { branch_id: string | number }) =>
        requestForBranch<any>(
            `/accounting/payroll/compliance-filings${buildQuery({
                branch_id: params?.branch_id,
            })}`,
            params?.branch_id,
        ),
    createPayrollRun: (data: any) =>
        requestForBranch<any>('/accounting/payroll', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    upsertPayrollRecoveryProfile: (data: any) =>
        requestForBranch<any>('/accounting/payroll/recovery-profiles', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    upsertPayrollComplianceSetting: (data: any) =>
        requestForBranch<any>('/accounting/payroll/compliance-settings', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createPayrollComplianceSettlement: (data: any) =>
        requestForBranch<any>('/accounting/payroll/compliance-settlements', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createPayrollComplianceFiling: (data: any) =>
        requestForBranch<any>('/accounting/payroll/compliance-filings', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updatePayrollRunStatus: (id: number | string, data: any, branchId?: string | number | null) =>
        requestForBranch<any>(`/accounting/payroll/${id}/status`, branchId, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    recordPayrollRunPayment: (id: number | string, data: any, branchId?: string | number | null) =>
        requestForBranch<any>(`/accounting/payroll/${id}/payments`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createPayrollAdvance: (data: any) =>
        requestForBranch<any>('/accounting/payroll/advances', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createPettyCashAccount: (data: any) =>
        requestForBranch<any>('/accounting/petty-cash/accounts', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createPettyCashRefill: (data: any) =>
        requestForBranch<any>('/accounting/petty-cash/refills', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getGeneralLedger: (accountId: number | string, params?: { branch_id?: string | number | null; date_from?: string; date_to?: string }) =>
        requestForBranch<any>(
            `/accounting/general-ledger${buildQuery({
                account_id: accountId,
                branch_id: params?.branch_id || undefined,
                date_from: params?.date_from,
                date_to: params?.date_to,
            })}`,
            params?.branch_id,
        ),
    getDayClosingPreview: (params?: { branch_id?: string | number | null; business_date?: string }) =>
        requestForBranch<any>(
            `/accounting/day-closing/preview${buildQuery({
                branch_id: params?.branch_id || undefined,
                business_date: params?.business_date,
            })}`,
            params?.branch_id,
        ),
    getDayClosingHistory: (branchId?: string | number | null) =>
        requestForBranch<any[]>(
            `/accounting/day-closing/history${buildQuery({
                branch_id: branchId || undefined,
            })}`,
            branchId,
        ),
    closeDay: (data: any) =>
        requestForBranch<any>('/accounting/day-closing/close', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getFinancialVouchers: (params?: { branch_id?: string | number | null; type?: string }) =>
        requestForBranch<any[]>(
            `/financial-vouchers${buildQuery({
                branch_id: params?.branch_id || undefined,
                type: params?.type,
            })}`,
            params?.branch_id,
        ),
    getFinancialVoucher: (id: number | string) => request<any>(`/financial-vouchers/${id}`),
    getFinancialVoucherPaymentPreview: (id: number | string) => request<any>(`/financial-vouchers/${id}/payment-preview`),
    createFinancialVoucher: (data: any) =>
        requestForBranch('/financial-vouchers', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    updateFinancialVoucher: (id: number | string, data: any) =>
        requestForBranch(`/financial-vouchers/${id}`, data?.branch_id, { method: 'PUT', body: JSON.stringify(data) }),
    updateFinancialVoucherStatus: (id: number | string, data: { status: string; note?: string }) =>
        request(`/financial-vouchers/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
    getReconciliationAccounts: () => request<any[]>('/accounting/reconciliation/accounts'),
    getReconciliation: (params: { account_id: number | string; branch_id?: string | number | null; date_from?: string; date_to?: string; activity_type?: string }) =>
        requestForBranch<any>(
            `/accounting/reconciliation${buildQuery({
                account_id: params.account_id,
                branch_id: params.branch_id || undefined,
                date_from: params.date_from,
                date_to: params.date_to,
                activity_type: params.activity_type,
            })}`,
            params.branch_id,
        ),
    createReconciliation: (data: any) =>
        requestForBranch<any>('/accounting/reconciliation', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    getInvestors: (params?: { branch_id?: string | number | null; search?: string; status?: string }) =>
        requestForBranch<any[]>(
            `/accounting/investors${buildQuery({
                branch_id: params?.branch_id || undefined,
                search: params?.search,
                status: params?.status,
            })}`,
            params?.branch_id,
        ),
    createInvestor: (data: any) => request('/accounting/investors', { method: 'POST', body: JSON.stringify(data) }),
    updateInvestor: (id: number | string, data: any) => request(`/accounting/investors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getInvestorStatement: (id: number | string, params?: { branch_id?: string | number | null; period_start?: string; period_end?: string }) =>
        requestForBranch<any>(
            `/accounting/investors/${id}/statement${buildQuery({
                branch_id: params?.branch_id || undefined,
                period_start: params?.period_start,
                period_end: params?.period_end,
            })}`,
            params?.branch_id,
        ),
    getInvestorAgreements: (params?: { branch_id?: string | number | null; investor_id?: string | number | null; status?: string }) =>
        requestForBranch<any[]>(
            `/accounting/investor-agreements${buildQuery({
                branch_id: params?.branch_id || undefined,
                investor_id: params?.investor_id || undefined,
                status: params?.status,
            })}`,
            params?.branch_id,
        ),
    createInvestorAgreement: (data: any) =>
        requestForBranch<any>('/accounting/investor-agreements', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    updateInvestorAgreement: (id: number | string, data: any) =>
        requestForBranch<any>(`/accounting/investor-agreements/${id}`, data?.branch_id, { method: 'PATCH', body: JSON.stringify(data) }),
    getInvestorTransactions: (params?: { branch_id?: string | number | null; investor_id?: string | number | null; agreement_id?: string | number | null; date_from?: string; date_to?: string }) =>
        requestForBranch<any[]>(
            `/accounting/investor-transactions${buildQuery({
                branch_id: params?.branch_id || undefined,
                investor_id: params?.investor_id || undefined,
                agreement_id: params?.agreement_id || undefined,
                date_from: params?.date_from,
                date_to: params?.date_to,
            })}`,
            params?.branch_id,
        ),
    createInvestorTransaction: (data: any) =>
        requestForBranch<any>('/accounting/investor-transactions', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    returnInvestorCapital: (data: any) =>
        requestForBranch<any>('/accounting/investor-transactions/return-capital', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    getProfitDistributionPreview: (params: { branch_id: string | number; period_start: string; period_end: string; distribution_frequency: string }) =>
        requestForBranch<any>(
            `/accounting/profit-distributions/preview${buildQuery(params)}`,
            params.branch_id,
        ),
    processProfitDistribution: (data: any) =>
        requestForBranch<any>('/accounting/profit-distributions/process', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    getProfitDistributions: (params?: { branch_id?: string | number | null }) =>
        requestForBranch<any[]>(
            `/accounting/profit-distributions${buildQuery({
                branch_id: params?.branch_id || undefined,
            })}`,
            params?.branch_id,
        ),
    getProfitDistributionBatch: (id: number | string) => request<any>(`/accounting/profit-distributions/${id}`),
    getLoans: (params?: { branch_id?: string | number | null; search?: string; status?: string }) =>
        requestForBranch<any[]>(
            `/accounting/loans${buildQuery({
                branch_id: params?.branch_id || undefined,
                search: params?.search,
                status: params?.status,
            })}`,
            params?.branch_id,
        ),
    createLoan: (data: any) =>
        requestForBranch<any>('/accounting/loans', data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    updateLoan: (id: number | string, data: any, branchId?: string | number | null) =>
        requestForBranch<any>(`/accounting/loans/${id}`, branchId, { method: 'PATCH', body: JSON.stringify(data) }),
    getLoanRepayments: (params?: { branch_id?: string | number | null; loan_id?: string | number | null; status?: string }) =>
        requestForBranch<any[]>(
            `/accounting/loan-repayments${buildQuery({
                branch_id: params?.branch_id || undefined,
                loan_id: params?.loan_id || undefined,
                status: params?.status,
            })}`,
            params?.branch_id,
        ),
    recordLoanRepayment: (data: any, branchId?: string | number | null) =>
        requestForBranch<any>('/accounting/loan-repayments', branchId, { method: 'POST', body: JSON.stringify(data) }),
    settleLoan: (data: any, branchId?: string | number | null) =>
        requestForBranch<any>('/accounting/loans/settle', branchId, { method: 'POST', body: JSON.stringify(data) }),
};

export const platformApi = {
    getClients: (filters?: { name?: string; status?: string }) => {
        const params = new URLSearchParams();
        if (filters?.name) params.append('name', filters.name);
        if (filters?.status) params.append('status', filters.status);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request<any[]>(`/platform/clients${qs}`);
    },
    getClient: (id: string) => request<any>(`/platform/clients/${id}`),
    createClient: (data: any) => request('/platform/clients', { method: 'POST', body: JSON.stringify(data) }),
    updateClient: (id: string, data: any) => request(`/platform/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getClientBranding: (id: string) => request<any>(`/platform/clients/${id}/branding`),
    updateClientBranding: (id: string, data: any) => request(`/platform/clients/${id}/branding`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadClientBrandingAsset: (id: string, assetKey: 'full_logo' | 'short_logo' | 'login_background', file: File) =>
        uploadFileRequest<any>(`/platform/clients/${id}/branding/assets/${assetKey}`, 'file', file),
    updateClientStatus: (id: string, status: string, reason: string, notes?: string) =>
        request(`/platform/clients/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, reason, notes }),
        }),
    getClientStatusHistory: (id: string) => request<any[]>(`/platform/clients/${id}/status-history`),
    getClientSubscriptionSummary: (id: string) => request<any>(`/platform/clients/${id}/subscription-summary`),
    getCurrentClientSubscription: (id: string) => request<any | null>(`/platform/clients/${id}/current-subscription`),
    getClientSubscriptions: (id: string) => request<any[]>(`/platform/clients/${id}/subscriptions`),
    assignClientSubscription: (id: string, data: any) =>
        request(`/platform/clients/${id}/subscriptions`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateClientSubscriptionStatus: (id: string, subscriptionId: number | string, data: any) =>
        request(`/platform/clients/${id}/subscriptions/${subscriptionId}/status`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    getClientAudit: (id: string, limit: number = 50) => request<any[]>(`/platform/clients/${id}/audit?limit=${limit}`),
    getClientInspection: (id: string) => request<any>(`/platform/clients/${id}/inspection`),
    getClientGovernance: (id: string) => request<any>(`/platform/clients/${id}/governance`),
    getClientGovernanceHistory: (id: string) => request<any[]>(`/platform/clients/${id}/governance/history`),
    updateClientGovernance: (id: string, data: any) =>
        request(`/platform/clients/${id}/governance`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    getAuditLogs: (params?: {
        search?: string;
        portal?: string;
        status?: string;
        client_id?: string;
        branch_id?: number | string;
        action?: string;
        entity?: string;
        actor_type?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }) => request<any>(`/platform/audit${buildQuery({
        search: params?.search,
        portal: params?.portal,
        status: params?.status,
        client_id: params?.client_id,
        branch_id: params?.branch_id,
        action: params?.action,
        entity: params?.entity,
        actor_type: params?.actor_type,
        date_from: params?.date_from,
        date_to: params?.date_to,
        limit: params?.limit,
        offset: params?.offset,
    })}`),
    getAuditLog: (id: string) => request<any>(`/platform/audit/${id}`),
    getSecurityOverview: () => request<any>('/platform/security/overview'),
    getSecuritySessions: (params?: {
        search?: string;
        status?: string;
        user_type?: string;
        limit?: number;
        offset?: number;
    }) => request<any>(`/platform/security/sessions${buildQuery({
        search: params?.search,
        status: params?.status,
        user_type: params?.user_type,
        limit: params?.limit,
        offset: params?.offset,
    })}`),
    getSecurityAccessLogs: (params?: {
        search?: string;
        portal?: string;
        min_status_code?: number;
        max_status_code?: number;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }) => request<any>(`/platform/security/access-logs${buildQuery({
        search: params?.search,
        portal: params?.portal,
        min_status_code: params?.min_status_code,
        max_status_code: params?.max_status_code,
        date_from: params?.date_from,
        date_to: params?.date_to,
        limit: params?.limit,
        offset: params?.offset,
    })}`),
    revokeSecuritySession: (sessionId: string, reason?: string) =>
        request<any>(`/platform/security/sessions/${sessionId}/revoke`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),
    deactivateClient: (id: string, reason: string = 'Suspended from client list') =>
        request(`/platform/clients/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'suspended', reason }),
        }),
    activateClient: (id: string, reason: string = 'Reactivated from client list') =>
        request(`/platform/clients/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'active', reason }),
        }),
    getClientModules: (id: string) => request<string[]>(`/platform/clients/${id}/modules`),
    assignClientModules: (id: string, modules: string[]) => request(`/platform/clients/${id}/modules`, { method: 'POST', body: JSON.stringify(modules) }),
    getClientBilling: (id: string) => request<any>(`/platform/clients/${id}/billing`),

    getSubscriptionPlans: () => request<any[]>('/platform/plans'),
    getSubscriptionPlan: (id: string | number) => request<any>(`/platform/plans/${id}`),
    createSubscriptionPlan: (data: any) => request('/platform/plans', { method: 'POST', body: JSON.stringify(data) }),
    updateSubscriptionPlan: (id: string | number, data: any) => request(`/platform/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateSubscriptionPlanStatus: (id: string | number, plan_status: string) =>
        request(`/platform/plans/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ plan_status }),
        }),
    deleteSubscriptionPlan: (id: string | number) => request(`/platform/plans/${id}`, { method: 'DELETE' }),
    getPlatformFeatures: () => request<any[]>('/platform/features'),
    createPlatformFeature: (data: any) => request('/platform/features', { method: 'POST', body: JSON.stringify(data) }),
    updatePlatformFeature: (id: string | number, data: any) => request(`/platform/features/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updatePlatformFeatureStatus: (id: string | number, is_active: boolean) =>
        request(`/platform/features/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active }),
        }),
    getPlanEntitlements: (id: string | number) => request<any>(`/platform/plans/${id}/entitlements`),
    updatePlanEntitlements: (id: string | number, feature_keys: string[]) =>
        request(`/platform/plans/${id}/entitlements`, {
            method: 'PUT',
            body: JSON.stringify({ feature_keys }),
        }),
    getPlanLimits: (id: string | number) => request<any>(`/platform/plans/${id}/limits`),
    updatePlanLimits: (id: string | number, data: any) =>
        request(`/platform/plans/${id}/limits`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    getClientEffectiveEntitlements: (id: string) => request<any>(`/platform/clients/${id}/effective-entitlements`),
    getClientOverrides: (id: string) => request<any>(`/platform/clients/${id}/overrides`),
    upsertClientFeatureOverride: (id: string, data: any) =>
        request(`/platform/clients/${id}/feature-overrides`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    removeClientFeatureOverride: (id: string, featureKey: string) =>
        request(`/platform/clients/${id}/feature-overrides/${featureKey}`, { method: 'DELETE' }),
    upsertClientLimitOverride: (id: string, data: any) =>
        request(`/platform/clients/${id}/limit-overrides`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    removeClientLimitOverride: (id: string, limitKey: string) =>
        request(`/platform/clients/${id}/limit-overrides/${limitKey}`, { method: 'DELETE' }),
    getOnboardingQueue: () => request<any[]>('/platform/onboarding'),
    getClientOnboarding: (id: string) => request<any>(`/platform/clients/${id}/onboarding`),
    getClientOnboardingTimeline: (id: string) => request<any[]>(`/platform/clients/${id}/onboarding/timeline`),
    getSupportDashboard: () => request<any>('/platform/support/dashboard'),
    getSupportIssuesSummary: () => request<any>('/platform/support/issues-summary'),
    getSupportClientSummary: (id: string) => request<any>(`/platform/support/clients/${id}/summary`),
    getSupportClientDiagnostics: (id: string) => request<any>(`/platform/support/clients/${id}/diagnostics`),
    startClientOnboarding: (id: string) =>
        request(`/platform/clients/${id}/onboarding/start`, { method: 'POST' }),
    updateClientOnboardingStep: (id: string, stepKey: string, data: any) =>
        request(`/platform/clients/${id}/onboarding/steps/${stepKey}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    retryClientOnboardingStep: (id: string, stepKey: string) =>
        request(`/platform/clients/${id}/onboarding/steps/${stepKey}/retry`, { method: 'POST' }),
    createClientInitialAdmin: (id: string, data: any) =>
        request(`/platform/clients/${id}/onboarding/create-initial-admin`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    activateClientOnboarding: (id: string) =>
        request(`/platform/clients/${id}/onboarding/activate`, { method: 'POST' }),
    getBlueprints: () => request<any[]>('/platform/blueprints'),
    getBlueprint: (id: string) => request<any>(`/platform/blueprints/${id}`),
    createBlueprint: (data: any) =>
        request('/platform/blueprints', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateBlueprint: (id: string, data: any) =>
        request(`/platform/blueprints/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    updateBlueprintStatus: (id: string, status: 'draft' | 'active' | 'retired') =>
        request(`/platform/blueprints/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),
    createBlueprintVersion: (id: string, data: any) =>
        request(`/platform/blueprints/${id}/versions`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    activateBlueprintVersion: (id: string, versionId: number | string) =>
        request(`/platform/blueprints/${id}/versions/${versionId}/activate`, {
            method: 'POST',
        }),
    getClientBlueprintAssignment: (id: string) =>
        request<any>(`/platform/clients/${id}/blueprint-assignment`),
    getClientBlueprintHistory: (id: string) =>
        request<any[]>(`/platform/clients/${id}/blueprint-history`),
    assignClientBlueprint: (id: string, data: any) =>
        request(`/platform/clients/${id}/blueprint-assignment`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    applyClientBlueprint: (id: string) =>
        request(`/platform/clients/${id}/blueprint-apply`, {
            method: 'POST',
        }),
    getSettings: () => request<any>('/client-settings'),
    updateSettings: (data: any) => request<any>('/client-settings', { method: 'PUT', body: JSON.stringify(data) }),
    getSystemSettings: () => request<any>('/platform/system-settings'),
    updateSystemSettings: (data: any) => request<any>('/platform/system-settings', { method: 'PUT', body: JSON.stringify(data) }),
    getSystemUsers: (filters?: { name?: string; role?: string; status?: string }) => {
        const params = new URLSearchParams();
        if (filters?.name) params.append('name', filters.name);
        if (filters?.role) params.append('role', filters.role);
        if (filters?.status) params.append('status', filters.status);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request<any[]>(`/platform/system-users${qs}`);
    },
    getSystemUser: (id: string) => request<any>(`/platform/system-users/${id}`),
    createSystemUser: (data: any) => request('/platform/system-users', { method: 'POST', body: JSON.stringify(data) }),
    updateSystemUser: (id: string, data: any) => request(`/platform/system-users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deactivateSystemUser: (id: string) => request(`/platform/system-users/${id}`, { method: 'DELETE' }),
    activateSystemUser: (id: string) => request(`/platform/system-users/${id}/activate`, { method: 'POST' }),
    getPermissionsRegistry: () => request<any[]>('/platform/security/registry/modules'),
    /** Nexus-only: returns only nexus_ prefixed modules. Used by Nexus AccessControl & PermissionRegistry pages. */
    getNexusRegistry: () => request<any[]>('/platform/security/registry/nexus-modules'),


    // Unified redirects
    getDepartments: () => request<any[]>('/platform/Departments'),
    createDepartment: (data: any) => request('/platform/Departments', { method: 'POST', body: JSON.stringify(data) }),
    updateDepartment: (id: string, data: any) => request(`/platform/Departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDepartment: (id: string) => request(`/platform/Departments/${id}`, { method: 'DELETE' }),
    getDesignations: () => request<any[]>('/platform/designations'),
    createDesignation: (data: any) => request('/platform/designations', { method: 'POST', body: JSON.stringify(data) }),
    updateDesignation: (id: string, data: any) => request(`/platform/designations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignation: (id: string) => request(`/platform/designations/${id}`, { method: 'DELETE' }),
};

export const setupApi = {
    getDepartments: () => request<any[]>('/setup/departments'),
    createDepartment: (data: any) => request('/setup/departments', { method: 'POST', body: JSON.stringify(data) }),
    updateDepartment: (id: string | number, data: any) => request(`/setup/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDepartment: (id: string | number) => request(`/setup/departments/${id}`, { method: 'DELETE' }),

    getDesignations: () => request<any[]>('/setup/designations'),
    createDesignation: (data: any) => request('/setup/designations', { method: 'POST', body: JSON.stringify(data) }),
    updateDesignation: (id: string | number, data: any) => request(`/setup/designations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDesignation: (id: string | number) => request(`/setup/designations/${id}`, { method: 'DELETE' }),

    getBranches: () => request<any[]>('/setup/branches', { skipBranchContext: true }),
    getRoles: () => request<any[]>('/setup/roles'),
    getTaxes: () => request<any[]>('/setup/taxes'),
    getTax: (id: string | number) => request<any>(`/setup/taxes/${id}`),
    createTax: (data: any) => request('/setup/taxes', { method: 'POST', body: JSON.stringify(data) }),
    updateTax: (id: string | number, data: any) => request(`/setup/taxes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTax: (id: string | number) => request(`/setup/taxes/${id}`, { method: 'DELETE' }),
    getPaymentMethods: () => request<any[]>('/setup/payment-methods'),
    createPaymentMethod: (data: any) => request('/setup/payment-methods', { method: 'POST', body: JSON.stringify(data) }),
    updatePaymentMethod: (id: string | number, data: any) => request(`/setup/payment-methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePaymentMethod: (id: string | number) => request(`/setup/payment-methods/${id}`, { method: 'DELETE' }),
};

export const systemRoleApi = {
    getRoles: (filters?: { name?: string }) => {
        const params = new URLSearchParams();
        if (filters?.name) params.append('name', filters.name);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request<any[]>(`/platform/roles${qs}`);
    },
    getRole: (id: string) => request<any>(`/platform/roles/${id}`),
    createRole: (data: any) => request('/platform/roles', { method: 'POST', body: JSON.stringify(data) }),
    updateRole: (id: string, data: any) => request(`/platform/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRole: (id: string) => request(`/platform/roles/${id}`, { method: 'DELETE' }),
};

export const systemGroupApi = {
    getGroups: (filters?: { name?: string }) => {
        const params = new URLSearchParams();
        if (filters?.name) params.append('name', filters.name);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request<any[]>(`/platform/groups${qs}`);
    },
    getGroup: (id: string) => request<any>(`/platform/groups/${id}`),
    createGroup: (data: any) => request('/platform/groups', { method: 'POST', body: JSON.stringify(data) }),
    updateGroup: (id: string, data: any) => request(`/platform/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteGroup: (id: string) => request(`/platform/groups/${id}`, { method: 'DELETE' }),
};

export const roleApi = {
    getRoles: () => request<any[]>('/setup/roles'),
    getRole: (id: string | number) => request<any>(`/setup/roles/${id}`),
    createRole: (data: any) => request('/setup/roles', { method: 'POST', body: JSON.stringify(data) }),
    updateRole: (id: string | number, data: any) => request(`/setup/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRole: (id: string | number) => request(`/setup/roles/${id}`, { method: 'DELETE' }),
    getPermissionsRegistry: () => request<any[]>('/setup/roles/permissions'),
};

export const userApi = {
    getUsers: () => request<any[]>('/setup/users'),
    getUser: (id: string | number) => request<any>(`/setup/users/${id}`),
    getMyProfile: () => request<any>('/setup/users/me'),
    updateMyProfile: (data: any) => request('/setup/users/me', { method: 'PUT', body: JSON.stringify(data) }),
    updateMySecurity: (data: any) => request('/setup/users/me/security', { method: 'PUT', body: JSON.stringify(data) }),
    inspectUserAccess: (id: string | number) => request<any>(`/setup/users/${id}/access`),
    createUser: (data: any) => request('/setup/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string | number, data: any) => request(`/setup/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    assignBranches: (id: string | number, data: any) => request(`/setup/users/${id}/branches`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id: string | number) => request(`/setup/users/${id}`, { method: 'DELETE' }),
};

export const attendanceApi = {
    getLogs: (params?: { branch_id?: string | number | null; department_id?: string | number | null; date_from?: string; date_to?: string; search?: string }) =>
        request<any>(`/setup/attendance${buildQuery({
            branch_id: params?.branch_id || undefined,
            department_id: params?.department_id || undefined,
            date_from: params?.date_from,
            date_to: params?.date_to,
            search: params?.search,
        })}`),
    getRoster: (branchId?: string | number | null) =>
        request<any[]>(`/setup/attendance/roster${buildQuery({ branch_id: branchId || undefined })}`),
    markAttendance: (data: any) =>
        request('/setup/attendance/mark', { method: 'POST', body: JSON.stringify(data) }),
    lockAttendance: (data: any) =>
        request('/setup/attendance/lock', { method: 'POST', body: JSON.stringify(data) }),
};


export const branchApi = {
    getBranches: (filters?: { name?: string; status?: string }) => {
        const params = new URLSearchParams();
        if (filters?.name) params.append('name', filters.name);
        if (filters?.status) params.append('status', filters.status);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return request<any[]>(`/setup/branches${qs}`, { skipBranchContext: true });
    },
    getBranch: (id: string) => requestForBranch<any>(`/setup/branches/${id}`, id),
    getBranchInventoryControlSettings: (id: string | number) => requestForBranch<any>(`/setup/branches/${id}/inventory-control-settings`, id),
    createBranch: (data: any) => request('/setup/branches', { method: 'POST', body: JSON.stringify(data) }),
    updateBranch: (id: string, data: any) => requestForBranch(`/setup/branches/${id}`, id, { method: 'PUT', body: JSON.stringify(data) }),
    updateBranchInventoryControlSettings: (id: string | number, data: any) => requestForBranch(`/setup/branches/${id}/inventory-control-settings`, id, { method: 'PUT', body: JSON.stringify(data) }),
    updateBranchStatus: (id: string, status: string) => requestForBranch(`/setup/branches/${id}/status`, id, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deactivateBranch: (id: string) => requestForBranch(`/setup/branches/${id}`, id, { method: 'DELETE' }),
    activateBranch: (id: string) => requestForBranch(`/setup/branches/${id}/activate`, id, { method: 'POST' }),
    getBranchModules: (id: string) => requestForBranch<string[]>(`/setup/branches/${id}/modules`, id),
    assignBranchModules: (id: string, modules: string[]) => requestForBranch(`/setup/branches/${id}/modules`, id, { method: 'POST', body: JSON.stringify(modules) }),

    // Layout and Table endpoints
    getLayout: (branchId: number) => request<any[]>(`/setup/branches/${branchId}/layout`),
    createFloor: (branchId: number, data: any) => request(`/setup/branches/${branchId}/floors`, { method: 'POST', body: JSON.stringify(data) }),
    updateFloor: (floorId: number, data: any) => request(`/setup/branches/floors/${floorId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFloor: (floorId: number) => request(`/setup/branches/floors/${floorId}`, { method: 'DELETE' }),
    createTable: (floorId: number, data: any) => request(`/setup/branches/floors/${floorId}/tables`, { method: 'POST', body: JSON.stringify(data) }),
    updateTable: (tableId: number, data: any) => request(`/setup/branches/tables/${tableId}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateTableStatus: (tableId: number, status: string) => request(`/setup/branches/tables/${tableId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    deleteTable: (tableId: number) => request(`/setup/branches/tables/${tableId}`, { method: 'DELETE' }),
    getLocations: (branchId: number | string) => requestForBranch<any[]>(`/setup/branches/${branchId}/locations`, branchId),
    createLocation: (branchId: number | string, data: any) => requestForBranch<any>(`/setup/branches/${branchId}/locations`, branchId, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateLocation: (locationId: number | string, data: any) => request<any>(`/setup/branches/locations/${locationId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    deleteLocation: (locationId: number | string) => request<any>(`/setup/branches/locations/${locationId}`, { method: 'DELETE' }),

    // Branch Charges
    getCharges: (branchId: number) => request<any[]>(`/setup/branches/${branchId}/charges`),
    createCharge: (branchId: number, data: any) => request(`/setup/branches/${branchId}/charges`, { method: 'POST', body: JSON.stringify(data) }),
    updateCharge: (branchId: number, chargeId: number, data: any) => request(`/setup/branches/${branchId}/charges/${chargeId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCharge: (branchId: number, chargeId: number) => request(`/setup/branches/${branchId}/charges/${chargeId}`, { method: 'DELETE' }),
};

export const vendorApi = {
    getVendors: () => request<any[]>('/inventory/vendors'),
    getVendor: (id: string | number) => request<any>(`/inventory/vendors/${id}`),
    createVendor: (data: any) => request('/inventory/vendors', { method: 'POST', body: JSON.stringify(data) }),
    updateVendor: (id: string | number, data: any) => request(`/inventory/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVendor: (id: string | number) => request(`/inventory/vendors/${id}`, { method: 'DELETE' }),
};

export const recipeApi = {
    getRecipes: () => request<any[]>('/recipes'),
    getCostingOverview: (branchId?: number | string | null) =>
        requestForBranch<any>(
            `/recipes/costing/overview${buildQuery({ branch_id: branchId || undefined })}`,
            branchId,
        ),
    getRecipe: (id: string | number) => request<any>(`/recipes/${id}`),
    getRecipeCosting: (id: string | number, branchId?: number | string | null) =>
        requestForBranch<any>(
            `/recipes/${id}/costing${buildQuery({ branch_id: branchId || undefined })}`,
            branchId,
        ),
    createRecipe: (data: any) => request('/recipes', { method: 'POST', body: JSON.stringify(data) }),
    updateRecipe: (id: string | number, data: any) => request(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRecipe: (id: string | number) => request(`/recipes/${id}`, { method: 'DELETE' }),
    getRecipesByProduct: (productId: string | number) => request<any[]>(`/recipes/product/${productId}`),
    getProductCosting: (productId: string | number, branchId?: number | string | null) =>
        requestForBranch<any>(
            `/recipes/product/${productId}/costing${buildQuery({ branch_id: branchId || undefined })}`,
            branchId,
        ),
    addIngredient: (recipeId: string | number, data: any) => request(`/recipes/${recipeId}/ingredients`, { method: 'POST', body: JSON.stringify(data) }),
    updateIngredient: (recipeId: string | number, ingId: string | number, data: any) => request(`/recipes/${recipeId}/ingredients/${ingId}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeIngredient: (recipeId: string | number, ingId: string | number) => request(`/recipes/${recipeId}/ingredients/${ingId}`, { method: 'DELETE' }),
};

export const productionApi = {
    getOrders: (params?: { branch_id?: number | string | null; status?: string; scope?: 'source' | 'destination' | 'all' }) =>
        requestForBranch<any[]>(
            `/production${buildQuery({
                branch_id: params?.branch_id || undefined,
                status: params?.status,
                scope: params?.scope,
            })}`,
            params?.branch_id,
        ),
    getOrder: (id: number | string, branchId?: number | string | null) =>
        requestForBranch<any>(`/production/${id}`, branchId),
    createOrder: (data: any) =>
        requestForBranch('/production', data?.source_branch_id ?? data?.destination_branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    queueOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/queue`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    issueOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/issue`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    rejectOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/reject`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    cancelOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/cancel`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    startOrder: (id: number | string, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/start`, branchId, { method: 'POST' }),
    completeOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/complete`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    dispatchOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/dispatch`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    receiveOrder: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch(`/production/${id}/receive`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

export const catalogApi = {
    getProducts: () => request<any[]>('/catalog/products'),
    getBranchProducts: (branchId?: number) => request<any[]>(`/catalog/branch-products${branchId ? `?branch_id=${branchId}` : ''}`),
    getProduct: (id: string) => request<any>(`/catalog/products/${id}`),
    createProduct: (data: any) => request('/catalog/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id: string, data: any) => request(`/catalog/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProduct: (id: string) => request(`/catalog/products/${id}`, { method: 'DELETE' }),
    getCategories: () => request<any[]>('/catalog/categories'),
    createCategory: (data: any) => request('/catalog/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string | number, data: any) => request(`/catalog/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCategory: (id: string | number) => request(`/catalog/categories/${id}`, { method: 'DELETE' }),
    getPriceProfiles: () => request<any[]>('/catalog/price-profiles'),
    createPriceProfile: (data: any) => request('/catalog/price-profiles', { method: 'POST', body: JSON.stringify(data) }),
    updatePriceProfile: (id: string | number, data: any) => request(`/catalog/price-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePriceProfile: (id: string | number) => request(`/catalog/price-profiles/${id}`, { method: 'DELETE' }),
    getMenuTypes: () => request<any[]>('/catalog/price-profiles'),
    createMenuType: (data: any) => request('/catalog/price-profiles', { method: 'POST', body: JSON.stringify(data) }),
    updateMenuType: (id: string | number, data: any) => request(`/catalog/price-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteMenuType: (id: string | number) => request(`/catalog/price-profiles/${id}`, { method: 'DELETE' }),
    getCuisineTypes: () => request<any[]>('/catalog/cuisine-types'),
    createCuisineType: (data: any) => request('/catalog/cuisine-types', { method: 'POST', body: JSON.stringify(data) }),
    updateCuisineType: (id: string | number, data: any) => request(`/catalog/cuisine-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCuisineType: (id: string | number) => request(`/catalog/cuisine-types/${id}`, { method: 'DELETE' }),
    getStations: () => request<any[]>('/catalog/stations'),
    createStation: (data: any) => request('/catalog/stations', { method: 'POST', body: JSON.stringify(data) }),
    updateStation: (id: string | number, data: any) => request(`/catalog/stations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteStation: (id: string | number) => request(`/catalog/stations/${id}`, { method: 'DELETE' }),
    getUoms: () => request<any[]>('/catalog/uoms'),
    seedDefaultUoms: () => request<any[]>('/catalog/uoms/seed-defaults', { method: 'POST' }),
    createUom: (data: any) => request('/catalog/uoms', { method: 'POST', body: JSON.stringify(data) }),
    updateUom: (id: string | number, data: any) => request(`/catalog/uoms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteUom: (id: string | number) => request(`/catalog/uoms/${id}`, { method: 'DELETE' }),
    getTaxonomyDependencies: (kind: string, id: string | number) => request<any>(`/catalog/taxonomies/${kind}/${id}/dependencies`),
    reassignTaxonomyDependencies: (kind: string, id: string | number, data: any) =>
        request<any>(`/catalog/taxonomies/${kind}/${id}/reassign`, { method: 'POST', body: JSON.stringify(data) }),
    setBranchMapping: (data: any) => request('/catalog/mappings', { method: 'POST', body: JSON.stringify(data) }),
    bulkSetBranchMapping: (data: any) => request('/catalog/mappings/bulk', { method: 'POST', body: JSON.stringify(data) }),
    getBranchPricing: (branchId?: number, PriceProfileId?: number) =>
        request<any>(`/catalog/branch-pricing${buildQuery({
            branch_id: branchId,
            price_profile_id: PriceProfileId,
        })}`),
    updateBranchPrice: (data: any) => request('/catalog/branch-pricing', { method: 'POST', body: JSON.stringify(data) }),
    getBranchMenu: (branchId: number, PriceProfileId?: number | null) =>
        request<any>(`/catalog/menu/branch/${branchId}${PriceProfileId ? `?price_profile_id=${PriceProfileId}` : ''}`),
    getBranchMenuByChannel: (branchId: number, params?: { PriceProfileId?: number | null; channel?: string | null }) =>
        request<any>(`/catalog/menu/branch/${branchId}${buildQuery({
            price_profile_id: params?.PriceProfileId || undefined,
            channel: params?.channel || undefined,
        })}`),
};

export const orderTypeApi = {
    getOrderTypes: () => request<any[]>('/master-data/order-types'),
    createOrderType: (data: any) => request('/master-data/order-types', { method: 'POST', body: JSON.stringify(data) }),
    updateOrderType: (id: string | number, data: any) => request(`/master-data/order-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteOrderType: (id: string | number) => request(`/master-data/order-types/${id}`, { method: 'DELETE' }),
};

export const analyticsApi = {
    getOperationsBranchOptions: () => request<any>('/analytics/operations/branch-options', { skipBranchContext: true }),
    getCommandCenter: (params?: {
        date_from?: string;
        date_to?: string;
        branch_ids?: Array<number | string>;
        sales_category_ids?: Array<number | string>;
        inventory_class_ids?: Array<number | string>;
    }) =>
        request<any>(`/analytics/command-center${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
            sales_category_ids: params?.sales_category_ids?.length ? params.sales_category_ids.join(',') : undefined,
            inventory_class_ids: params?.inventory_class_ids?.length ? params.inventory_class_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getExecutiveKpis: (params?: {
        date_from?: string;
        date_to?: string;
        branch_ids?: Array<number | string>;
    }) =>
        request<any>(`/analytics/kpi${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getMenuEngineering: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/menu-engineering${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiSalesTrends: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/sales-trends${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiBranchAnalytics: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/branch${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiStationAnalytics: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/station${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiInventoryAnalytics: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/inventory${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiWasteAnalytics: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/waste${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiForecast: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/forecast${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBiRecommendations: (params?: { date_from?: string; date_to?: string; branch_ids?: Array<number | string> }) =>
        request<any>(`/analytics/recommendations${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getSalesForecast: (branchId?: number) => request<any>(`/analytics/sales-forecast${branchId ? `?branchId=${branchId}` : ''}`),
    getRecommendationOverview: (branchId?: number) => request<any>(`/analytics/recommendations/overview${branchId ? `?branchId=${branchId}` : ''}`),
    getReorderRecommendations: (branchId?: number) => request<any>(`/analytics/recommendations/reorder${branchId ? `?branchId=${branchId}` : ''}`),
    getWasteAnalysis: (branchId?: number) => request<any>(`/analytics/waste-analysis${branchId ? `?branchId=${branchId}` : ''}`),
    getManagementKpis: (params?: {
        date_from?: string;
        date_to?: string;
        branch_ids?: Array<number | string>;
        sales_category_ids?: Array<number | string>;
        inventory_class_ids?: Array<number | string>;
    }) =>
        request<any>(`/analytics/management/kpis${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
            sales_category_ids: params?.sales_category_ids?.length ? params.sales_category_ids.join(',') : undefined,
            inventory_class_ids: params?.inventory_class_ids?.length ? params.inventory_class_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getBranchManagementSnapshot: (
        branchId: number | string,
        params?: {
            date_from?: string;
            date_to?: string;
            sales_category_ids?: Array<number | string>;
            inventory_class_ids?: Array<number | string>;
        },
    ) =>
        requestForBranch<any>(`/analytics/management/branches/${branchId}${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            sales_category_ids: params?.sales_category_ids?.length ? params.sales_category_ids.join(',') : undefined,
            inventory_class_ids: params?.inventory_class_ids?.length ? params.inventory_class_ids.join(',') : undefined,
        })}`, branchId),
    getOperationsOverview: (params?: {
        date_from?: string;
        date_to?: string;
        branch_ids?: Array<number | string>;
        sales_category_ids?: Array<number | string>;
        inventory_class_ids?: Array<number | string>;
    }) =>
        request<any>(`/analytics/operations/overview${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            branch_ids: params?.branch_ids?.length ? params.branch_ids.join(',') : undefined,
            sales_category_ids: params?.sales_category_ids?.length ? params.sales_category_ids.join(',') : undefined,
            inventory_class_ids: params?.inventory_class_ids?.length ? params.inventory_class_ids.join(',') : undefined,
        })}`, { skipBranchContext: true }),
    getOperationsBranchDetail: (
        branchId: number | string,
        params?: {
            date_from?: string;
            date_to?: string;
            sales_category_ids?: Array<number | string>;
            inventory_class_ids?: Array<number | string>;
        },
    ) =>
        requestForBranch<any>(`/analytics/operations/branches/${branchId}${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            sales_category_ids: params?.sales_category_ids?.length ? params.sales_category_ids.join(',') : undefined,
            inventory_class_ids: params?.inventory_class_ids?.length ? params.inventory_class_ids.join(',') : undefined,
        })}`, branchId),
    getBranchMetrics: (
        branchId: number,
        params?: {
            date_from?: string;
            date_to?: string;
            sales_category_ids?: Array<number | string>;
            inventory_class_ids?: Array<number | string>;
        },
    ) =>
        requestForBranch<any>(`/analytics/branch/${branchId}${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
            sales_category_ids: params?.sales_category_ids?.length ? params.sales_category_ids.join(',') : undefined,
            inventory_class_ids: params?.inventory_class_ids?.length ? params.inventory_class_ids.join(',') : undefined,
        })}`, branchId),
};

export const posApi = {
    // Orders
    createOrder: (branchId: number, data: any) => requestForBranch(`/pos/branches/${branchId}/orders`, branchId, { method: 'POST', body: JSON.stringify(data) }),
    getOrders: (branchId: number, status?: string) => requestForBranch<any[]>(`/pos/branches/${branchId}/orders${status ? `?status=${status}` : ''}`, branchId),
    getSaleProducts: (branchId: number) => requestForBranch<any[]>(`/pos/branches/${branchId}/products`, branchId),
    getOrder: (orderId: number, branchId?: number | string | null) => requestForBranch<any>(`/pos/orders/${orderId}`, branchId),
    getOrderReceipt: (orderId: number, branchId?: number | string | null) => requestForBranch<any>(`/pos/orders/${orderId}/receipt`, branchId),
    getUserHistoryUsers: (params?: {
        branch_id?: number | string | null;
        search?: string;
    }) => requestForBranch<any[]>(
        `/pos/user-history/users${buildQuery({
            branch_id: params?.branch_id || undefined,
            search: params?.search || undefined,
        })}`,
        params?.branch_id,
    ),
    getUserActivityHistory: (params?: {
        branch_id?: number | string | null;
        user_id?: number | string | null;
        date_from?: string;
        date_to?: string;
    }) => requestForBranch<any>(
        `/pos/user-history${buildQuery({
            branch_id: params?.branch_id || undefined,
            user_id: params?.user_id || undefined,
            date_from: params?.date_from || undefined,
            date_to: params?.date_to || undefined,
        })}`,
        params?.branch_id,
    ),
    searchBillVoidOrders: (params?: {
        branch_id?: number | string | null;
        order_no?: string;
        kot_no?: string;
        customer?: string;
        date_from?: string;
        date_to?: string;
        payment_type?: string;
        payment_status?: string;
        credit_only?: boolean;
        status?: string;
    }) => requestForBranch<any[]>(
        `/pos/bill-void/orders${buildQuery({
            branch_id: params?.branch_id || undefined,
            order_no: params?.order_no || undefined,
            kot_no: params?.kot_no || undefined,
            customer: params?.customer || undefined,
            date_from: params?.date_from || undefined,
            date_to: params?.date_to || undefined,
            payment_type: params?.payment_type && params.payment_type !== 'all' ? params.payment_type : undefined,
            payment_status: params?.payment_status && params.payment_status !== 'all' ? params.payment_status : undefined,
            credit_only: params?.credit_only ? 'true' : undefined,
            status: params?.status && params.status !== 'all' ? params.status : undefined,
        })}`,
        params?.branch_id,
    ),
    getBillVoidReport: (params?: {
        branch_id?: number | string | null;
        customer?: string;
        user?: string;
        date_from?: string;
        date_to?: string;
        payment_type?: string;
        amount_min?: string | number;
        amount_max?: string | number;
    }) => requestForBranch<any>(
        `/pos/bill-void/report${buildQuery({
            branch_id: params?.branch_id || undefined,
            customer: params?.customer || undefined,
            user: params?.user || undefined,
            date_from: params?.date_from || undefined,
            date_to: params?.date_to || undefined,
            payment_type: params?.payment_type && params.payment_type !== 'all' ? params.payment_type : undefined,
            amount_min: params?.amount_min || undefined,
            amount_max: params?.amount_max || undefined,
        })}`,
        params?.branch_id,
    ),
    voidBill: (orderId: number | string, data: any) =>
        requestForBranch<any>(`/pos/bill-void/orders/${orderId}/void`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    updateOrderHeader: (orderId: number, data: any) => {
        const safeHeaderPayload = {
            branch_id: data?.branch_id,
            order_type: data?.order_type,
            table_id: data?.table_id,
            customer_id: data?.customer_id,
            order_taker_user_id: data?.order_taker_user_id,
            order_note: data?.order_note,
            delivery_details: data?.delivery_details,
        };
        return requestForBranch(`/pos/orders/${orderId}/header`, data?.branch_id, { method: 'PATCH', body: JSON.stringify(safeHeaderPayload) });
    },
    addItems: (orderId: number, items: any[], branchId?: number | string | null) => requestForBranch(`/pos/orders/${orderId}/items`, branchId, { method: 'POST', body: JSON.stringify({ items }) }),
    updateItem: (orderId: number, itemId: number, data: any) => requestForBranch(`/pos/orders/${orderId}/items/${itemId}`, data?.branch_id, { method: 'PATCH', body: JSON.stringify(withoutBranchId(data)) }),
    removeItem: (orderId: number, itemId: number, data?: any) => requestForBranch(`/pos/orders/${orderId}/items/${itemId}`, data?.branch_id, { method: 'DELETE', body: JSON.stringify(withoutBranchId(data)) }),
    updateOrderStatus: (orderId: number, order_status: string, branchId?: number | string | null) => requestForBranch(`/pos/orders/${orderId}/status`, branchId, { method: 'PUT', body: JSON.stringify({ order_status }) }),
    submitOrderToKitchen: (orderId: number, branchId?: number | string | null) => requestForBranch(`/pos/orders/${orderId}/submit-kot`, branchId, { method: 'POST' }),
    cancelOrder: (orderId: number, data: any) => requestForBranch(`/pos/orders/${orderId}/cancel`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    reassignOrderTable: (orderId: number, table_id?: number, branchId?: number | string | null) => requestForBranch(`/pos/orders/${orderId}/table`, branchId, { method: 'PUT', body: JSON.stringify({ table_id }) }),
    updateOrderItemStatus: (itemId: number, item_status: string, branch_id?: number, data?: any) => requestForBranch(`/pos/order-items/${itemId}/status`, branch_id ?? data?.branch_id, {
        method: 'PUT',
        body: JSON.stringify({ ...(branch_id ? { branch_id } : {}), ...(data ?? {}), item_status }),
    }),
    closeOrder: (orderId: number, data: any) => requestForBranch(`/pos/orders/${orderId}/close`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    creditSaleOrder: (orderId: number, data: any) => requestForBranch(`/pos/orders/${orderId}/credit-sale`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    settleCreditOrder: (orderId: number, data: any) => requestForBranch(`/pos/orders/${orderId}/settle-credit`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),
    returnOrder: (orderId: number, data: any) => requestForBranch(`/pos/orders/${orderId}/return`, data?.branch_id, { method: 'POST', body: JSON.stringify(data) }),

    // Branch operational support
    getTables: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/tables`),
    getBranchDashboard: (branchId: number) => request<any>(`/pos/branches/${branchId}/dashboard`),

    // Kitchen Display
    getKots: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/kots`),
    updateKotStatus: (branchId: number, kotId: string, status: string) => requestForBranch(`/pos/branches/${branchId}/kots/${kotId}/status`, branchId, { method: 'PUT', body: JSON.stringify({ status }) }),

    // Reporting
    getSalesSummary: (branchId: number, params?: { date_from?: string; date_to?: string }) =>
        request<any>(`/pos/branches/${branchId}/reports/sales${buildQuery({
            date_from: params?.date_from,
            date_to: params?.date_to,
        })}`),
    getTopItems: (branchId: number, params?: { limit?: number; date_from?: string; date_to?: string }) =>
        request<any[]>(`/pos/branches/${branchId}/reports/top-items${buildQuery({
            limit: params?.limit,
            date_from: params?.date_from,
            date_to: params?.date_to,
        })}`),

    // Day operations and counter-session controls.
    // Legacy shift endpoints remain in place only where the current backend compatibility layer still requires them.
    openShift: (branchId: number, float: number) => request(`/pos/branches/${branchId}/shifts/open`, { method: 'POST', body: JSON.stringify({ opening_float: float }) }),
    getCurrentShift: (branchId: number) => request<any>(`/pos/branches/${branchId}/shifts/current`),
    closeShift: (branchId: number, shiftId: number, data: any) => request(`/pos/branches/${branchId}/shifts/${shiftId}/close`, { method: 'POST', body: JSON.stringify(data) }),
    getShifts: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/shifts`),
    getOperationsConsole: (branchId: number) => request<any>(`/pos/branches/${branchId}/operations/console`),
    getOrderTakers: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/order-takers`),
    openBusinessDay: (branchId: number, data: { title: string; business_date: string; opened_at?: string; planned_closing_at?: string; notes?: string }) =>
        request<any>(`/pos/branches/${branchId}/business-days/open`, { method: 'POST', body: JSON.stringify(data) }),
    markOffDay: (branchId: number, data: { title: string; business_date: string; opened_at?: string; planned_closing_at?: string; off_day_reason: string; notes?: string }) =>
        request<any>(`/pos/branches/${branchId}/business-days/off-day`, { method: 'POST', body: JSON.stringify({ ...data, is_off_day: true }) }),
    closeBusinessDaySession: (branchId: number, businessDayId: number, data?: { notes?: string }) =>
        request<any>(`/pos/branches/${branchId}/business-days/${businessDayId}/close`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
    getBusinessDayZReport: (branchId: number, businessDayId: number) =>
        request<any>(`/pos/branches/${branchId}/business-days/${businessDayId}/z-report`),
    getShiftTemplates: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/shift-templates`),
    createShiftTemplate: (branchId: number, data: any) =>
        request<any>(`/pos/branches/${branchId}/shift-templates`, { method: 'POST', body: JSON.stringify(data) }),
    updateShiftTemplate: (branchId: number, templateId: number, data: any) =>
        request<any>(`/pos/branches/${branchId}/shift-templates/${templateId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    startOperatingShift: (branchId: number, data: { shift_template_id: number }) =>
        request<any>(`/pos/branches/${branchId}/shifts/start`, { method: 'POST', body: JSON.stringify(data) }),
    updateOperatingShift: (branchId: number, shiftId: number, data: { shift_name?: string; planned_start?: string; planned_end?: string }) =>
        request<any>(`/pos/branches/${branchId}/shifts/${shiftId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    endOperatingShift: (branchId: number, shiftId: number) =>
        request<any>(`/pos/branches/${branchId}/shifts/${shiftId}/end`, { method: 'POST' }),
    assignCounterSession: (branchId: number, shiftId: number, data: { sale_counter_id: number; user_id: number; assigned_float: number }) =>
        request<any>(`/pos/branches/${branchId}/shifts/${shiftId}/counter-sessions`, { method: 'POST', body: JSON.stringify(data) }),
    reassignCounterSession: (branchId: number, sessionId: number, data: { sale_counter_id: number; user_id: number; assigned_float: number }) =>
        request<any>(`/pos/branches/${branchId}/counter-sessions/${sessionId}/reassign`, { method: 'PATCH', body: JSON.stringify(data) }),
    unassignCounterSession: (branchId: number, sessionId: number) =>
        request<any>(`/pos/branches/${branchId}/counter-sessions/${sessionId}`, { method: 'DELETE' }),
    getMyCounterSession: (branchId: number) => request<any | null>(`/pos/branches/${branchId}/counter-sessions/mine`),
    getMyCounterSessions: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/counter-sessions/mine/all`),
    getCounterSessionHistory: (branchId: number, limit: number = 20) =>
        request<any[]>(`/pos/branches/${branchId}/counter-sessions/history?limit=${limit}`),
    getCounterSessionXReport: (branchId: number, sessionId: number) =>
        request<any>(`/pos/branches/${branchId}/counter-sessions/${sessionId}/x-report`),
    verifyCounterOpening: (branchId: number, sessionId: number, data: { verified_opening_cash: number }) =>
        request<any>(`/pos/branches/${branchId}/counter-sessions/${sessionId}/verify-open`, { method: 'POST', body: JSON.stringify(data) }),
    blindCloseCounterSession: (branchId: number, sessionId: number, data: { blind_count: number; cashier_username: string; cashier_pin: string; authorized_username: string; authorized_pin: string; notes?: string }) =>
        request<any>(`/pos/branches/${branchId}/counter-sessions/${sessionId}/blind-close`, { method: 'POST', body: JSON.stringify(data) }),
    verifyCounterClosing: (branchId: number, sessionId: number, data: { authorized_username: string; supervisor_pin: string; reconciliation_notes?: string }) =>
        request<any>(`/pos/branches/${branchId}/counter-sessions/${sessionId}/verify-close`, { method: 'POST', body: JSON.stringify(data) }),

    // Manager-led business-day blind-close workflow.
    startBusinessDay: (branchId: number, data: { business_date: string; tills: { sale_counter_id: number; assigned_float: number }[] }) =>
        request<any>(`/pos/branches/${branchId}/day/start`, { method: 'POST', body: JSON.stringify(data) }),
    getAuthorizedTills: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/day/authorized-tills`),
    submitBlindCount: (branch_id: number, till_id: number, data: { blind_count: number; cashier_username: string; cashier_pin: string; authorized_username: string; authorized_pin: string; notes?: string }) =>
        request<any>(`/pos/branches/${branch_id}/day/tills/${till_id}/blind-count`, { method: 'POST', body: JSON.stringify(data) }),
    reconcileTill: (branchId: number, tillId: number, data: { reconciliation_notes?: string }) =>
        request<any>(`/pos/branches/${branchId}/day/tills/${tillId}/reconcile`, { method: 'POST', body: JSON.stringify(data) }),
    reassignTill: (branchId: number, tillId: number, data: { user_id?: number; assigned_float?: number }) =>
        request<any>(`/pos/branches/${branchId}/day/tills/${tillId}/reassign`, { method: 'PATCH', body: JSON.stringify(data) }),
    authorizeTill: (branchId: number, data: { sale_counter_id: number; user_id?: number; assigned_float: number }) =>
        request<any>(`/pos/branches/${branchId}/day/tills/authorize`, { method: 'POST', body: JSON.stringify(data) }),
    activateTill: (branchId: number, tillId: number) =>
        request<any>(`/pos/branches/${branchId}/day/tills/${tillId}/activate`, { method: 'POST' }),
    getCounterHistory: (branchId: number, counterId: number) =>
        request<any[]>(`/pos/branches/${branchId}/counters/${counterId}/history`),

    getShiftAnalytics: (shiftId: number) => request<any>(`/pos/shifts/${shiftId}/analytics`),


    // Offline POS
    registerDevice: (data: any) => request<any>('/pos/devices/register', { method: 'POST', body: JSON.stringify(data) }),
    syncBatch: (data: any) => request<any>('/pos/sync/batch', { method: 'POST', body: JSON.stringify(data) }),
    getDevices: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/devices`),
    getCardMachines: (branchId: number) => request<any[]>(`/pos/branches/${branchId}/card-machines`),
    createCardMachine: (branchId: number, data: any) =>
        request<any>(`/pos/branches/${branchId}/card-machines`, { method: 'POST', body: JSON.stringify(data) }),
    updateCardMachine: (branchId: number, machineId: number, data: any) =>
        request<any>(`/pos/branches/${branchId}/card-machines/${machineId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getDeviceSyncEvents: (branchId: number, deviceId: number, params?: { status?: string; limit?: number }) =>
        request<any>(
            `/pos/branches/${branchId}/devices/${deviceId}/sync-events${buildQuery({
                status: params?.status,
                limit: params?.limit,
            })}`,
        ),
    getOfflineReconciliation: (branchId: number) => request<any>(`/pos/branches/${branchId}/offline/reconciliation`),
    reconcileSyncEvent: (
        branchId: number,
        deviceId: number,
        syncEventId: number,
        data: { action: 'acknowledge' | 'resolve'; note?: string },
    ) => request<any>(
        `/pos/branches/${branchId}/devices/${deviceId}/sync-events/${syncEventId}/reconcile`,
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    ),
};

export const customerApi = {
    getCustomers: (params?: { search?: string; status?: string }) =>
        request<any[]>(`/customers${buildQuery({
            search: params?.search,
            status: params?.status,
        })}`),
    getSummary: () => request<any>('/customers/summary'),
    getCustomer: (id: number | string) => request<any>(`/customers/${id}`),
    createCustomer: (data: any) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
    updateCustomer: (id: number | string, data: any) => request(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getPurchaseHistory: (id: number | string, limit?: number) =>
        request<any[]>(`/customers/${id}/purchase-history${buildQuery({ limit })}`),
    getLoyaltyLedger: (id: number | string, limit?: number) =>
        request<any[]>(`/customers/${id}/loyalty-ledger${buildQuery({ limit })}`),
    adjustLoyalty: (id: number | string, data: any) =>
        request(`/customers/${id}/loyalty-adjustments`, { method: 'POST', body: JSON.stringify(data) }),
    findByPhone: (phone: string) => request<any>(`/customers/search${buildQuery({ phone })}`),
};

export const cateringApi = {
    getDashboard: () => request<any>('/catering/dashboard'),
    getOptions: (branchId?: number | string | null) =>
        requestForBranch<any>(
            `/catering/options${buildQuery({ branch_id: branchId || undefined })}`,
            branchId,
        ),
    getInquiries: (params?: { branch_id?: number | string | null; status?: string; search?: string }) =>
        requestForBranch<any[]>(
            `/catering/inquiries${buildQuery({
                branch_id: params?.branch_id || undefined,
                status: params?.status,
                search: params?.search,
            })}`,
            params?.branch_id,
        ),
    createInquiry: (data: any) =>
        requestForBranch<any>('/catering/inquiries', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateInquiry: (id: number | string, data: any) =>
        requestForBranch<any>(`/catering/inquiries/${id}`, data?.branch_id, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    getQuotations: (params?: { branch_id?: number | string | null; status?: string; search?: string }) =>
        requestForBranch<any[]>(
            `/catering/quotations${buildQuery({
                branch_id: params?.branch_id || undefined,
                status: params?.status,
                search: params?.search,
            })}`,
            params?.branch_id,
        ),
    getQuotation: (id: number | string, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/quotations/${id}`, branchId),
    createQuotation: (data: any, branchId?: number | string | null) =>
        requestForBranch<any>('/catering/quotations', branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateQuotation: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/quotations/${id}`, branchId, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    updateQuotationStatus: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/quotations/${id}/status`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    convertQuotation: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/quotations/${id}/convert`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getEvents: (params?: { branch_id?: number | string | null; status?: string; search?: string }) =>
        requestForBranch<any[]>(
            `/catering/events${buildQuery({
                branch_id: params?.branch_id || undefined,
                status: params?.status,
                search: params?.search,
            })}`,
            params?.branch_id,
        ),
    getEvent: (id: number | string, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}`, branchId),
    updateEvent: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}`, branchId, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    updateEventStatus: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}/status`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createEventProcurement: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}/procurement`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    createEventProduction: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}/production`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    issueBilling: (id: number | string, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}/issue-billing`, branchId, { method: 'POST' }),
    issueEventBilling: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}/billings`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    recordSettlement: (id: number | string, data: any, branchId?: number | string | null) =>
        requestForBranch<any>(`/catering/events/${id}/settlements`, branchId, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

export const dealsApi = {
    getVouchers: () => request<any[]>('/deals/vouchers'),
    createVoucher: (data: any) => request('/deals/vouchers', { method: 'POST', body: JSON.stringify(data) }),
    updateVoucher: (id: number | string, data: any) => request(`/deals/vouchers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    validateVoucher: (data: any) =>
        requestForBranch<any>('/deals/vouchers/validate', data?.branch_id, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getRecentRedemptions: () => request<any[]>('/deals/vouchers/redemptions/recent'),
};

export const saleCounterApi = {
    getAll: (branchId?: number) => request<any[]>(`/pos/sale-counters${branchId ? `?branch_id=${branchId}` : ''}`),
    getOne: (id: number) => request<any>(`/pos/sale-counters/${id}`),
    create: (data: any) => request('/pos/sale-counters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/pos/sale-counters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request(`/pos/sale-counters/${id}`, { method: 'DELETE' }),
};

export const authApi = {
    me: async () => {
        const res = await request<{ user_context: any }>('/auth/me', { skipBranchContext: true });
        return res.user_context;
    },
    systemLogin: (data: any) => request<any>('/auth/system-login', { method: 'POST', body: JSON.stringify(data) }),
    clientLogin: (data: any) => request<any>('/auth/client-login', { method: 'POST', body: JSON.stringify(data) }),
    customerLogin: (data: any) => request<any>('/auth/customer-login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request<any>('/auth/logout', { method: 'POST' }),
};

export const themeApi = {
    getThemes: (clientId?: number) => request<any[]>(`/platform/themes${clientId ? `?client_id=${clientId}` : ''}`),
    getTheme: (id: string) => request<any>(`/platform/themes/${id}`),
    createTheme: (data: any) => request('/platform/themes', { method: 'POST', body: JSON.stringify(data) }),
    updateTheme: (id: string, data: any) => request(`/platform/themes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTheme: (id: string) => request(`/platform/themes/${id}`, { method: 'DELETE' }),
    activateTheme: (id: string, clientId?: number) => request(`/platform/themes/${id}/activate${clientId ? `?client_id=${clientId}` : ''}`, { method: 'POST' }),
    reseed: () => request('/platform/themes/admin/reseed', { method: 'POST' }),
};

export const platformDashboardApi = {
    getOverview: () => request<any>('/platform/dashboard/overview'),
    getAttentionSummary: () => request<any>('/platform/dashboard/attention'),
    getKpis: (start?: string, end?: string) => request<any>(`/platform/dashboard/kpis${start ? `?start=${start}&end=${end}` : ''}`),
    getRevenueTrend: (months: number = 6) => request<any[]>(`/platform/dashboard/revenue-trend?months=${months}`),
    getRecentActivity: (limit: number = 10) => request<any>(`/platform/dashboard/recent-activity?limit=${limit}`),
    getHealth: () => request<any>('/platform/dashboard/health'),
};
