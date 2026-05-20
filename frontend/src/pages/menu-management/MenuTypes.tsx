/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { MenuMasterPage, type MasterRecord } from './MenuMasterPage';
import { catalogApi, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

export function MenuTypes() {
    const [records, setRecords] = useState<MasterRecord[]>([]);
    const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [menuTypes, branchItems] = await Promise.all([
                    catalogApi.getMenuTypes(),
                    setupApi.getBranches(),
                ]);
                setRecords(menuTypes.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    code: item.code || '',
                    description: item.description || '',
                    is_active: item.is_active,
                    sort_order: item.sort_order || 0,
                    branchAvailability: item.branchAvailability || {},
                })));
                setBranches(branchItems.map((branch: any) => ({
                    id: String(branch.id),
                    name: branch.branch_name,
                    code: branch.branch_code,
                })));
            } catch (error) {
                console.error('Failed to load menu types', error);
                toast.error('Menu Types', 'Could not load menu master types.');
            }
        };

        void load();
    }, []);

    return (
        <MenuMasterPage
            title="Menu Types"
            description="Define different types of menus used across POS and service channels."
            icon={<LayoutGrid size={24} />}
            initialData={records}
            branches={branches}
            onSave={async (record) => {
                const payload = {
                    name: record.name,
                    code: record.code,
                    description: record.description,
                    is_active: record.is_active,
                    sort_order: record.sort_order,
                    branchAvailability: record.branchAvailability,
                };
                const saved: any = record.id
                    ? await catalogApi.updateMenuType(record.id, payload)
                    : await catalogApi.createMenuType(payload);
                return {
                    id: saved.id,
                    name: saved.name,
                    code: saved.code || '',
                    description: saved.description || '',
                    is_active: saved.is_active,
                    sort_order: saved.sort_order || 0,
                    branchAvailability: saved.branchAvailability || {},
                } satisfies MasterRecord;
            }}
            onDelete={async (id) => { await catalogApi.deleteMenuType(id); }}
        />
    );
}
