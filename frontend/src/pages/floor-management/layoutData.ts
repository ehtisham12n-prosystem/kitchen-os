import { branchApi, resolveActiveBranchId, setupApi } from '../../api/api';

export type UiTableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Blocked';

export interface LayoutTableRecord {
    id: number;
    floor_id: number;
    floor_name: string;
    table_no: string;
    table_name: string;
    seating_capacity: number;
    current_status: UiTableStatus;
    is_active: boolean;
    updated_at?: string;
}

export interface LayoutFloorRecord {
    id: number;
    name: string;
    code: string;
    description: string;
    status: 'Active' | 'Inactive';
    last_updated: string;
    display_order: number;
    is_active: boolean;
    tables: LayoutTableRecord[];
}

export interface ActiveBranchLayout {
    branchId: number | null;
    branchName: string;
    floors: LayoutFloorRecord[];
}

function toNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatDateTime(value?: string | Date | null) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function uiTableStatusToApi(status: UiTableStatus) {
    switch (status) {
        case 'Occupied':
            return 'occupied';
        case 'Reserved':
            return 'reserved';
        case 'Blocked':
            return 'cleaning';
        case 'Available':
        default:
            return 'vacant';
    }
}

export async function loadActiveBranchLayout(): Promise<ActiveBranchLayout> {
    const branches = await setupApi.getBranches();
    const preferredBranchId = toNumber(resolveActiveBranchId());
    const defaultBranchId = preferredBranchId ?? toNumber(branches[0]?.id);

    if (!defaultBranchId) {
        return {
            branchId: null,
            branchName: '',
            floors: [],
        };
    }

    const layout = await branchApi.getLayout(defaultBranchId);
    const branchName =
        branches.find((branch) => Number(branch.id) === defaultBranchId)?.branch_name ?? '';

    return {
        branchId: defaultBranchId,
        branchName,
        floors: (layout ?? []).map((floor: any) => ({
            id: Number(floor.id),
            name: floor.name || floor.floor_name || '',
            code: floor.code || floor.floor_code || '',
            description: floor.description || '',
            status: floor.status === 'Inactive' || floor.is_active === false ? 'Inactive' : 'Active',
            last_updated: formatDateTime(floor.last_updated || floor.updated_at || floor.created_at),
            display_order: Number(floor.display_order || 0),
            is_active: floor.status === 'Inactive' || floor.is_active === false ? false : true,
            tables: (floor.tables ?? []).map((table: any) => ({
                id: Number(table.id),
                floor_id: Number(table.floor_id || floor.id),
                floor_name: floor.name || floor.floor_name || '',
                table_no: table.table_no || table.table_number || '',
                table_name: table.table_name || table.table_no || table.table_number || '',
                seating_capacity: Number(table.seating_capacity || table.capacity || 0),
                current_status: (table.current_status || 'Available') as UiTableStatus,
                is_active: table.is_active !== false,
                updated_at: table.updated_at || table.created_at || null,
            })),
        })),
    };
}
