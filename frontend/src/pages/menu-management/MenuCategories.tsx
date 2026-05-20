/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { MenuMasterPage, type MasterRecord } from './MenuMasterPage';
import { catalogApi, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

export function MenuCategories() {
    const [records, setRecords] = useState<MasterRecord[]>([]);
    const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [categories, branchItems] = await Promise.all([
                    catalogApi.getCategories(),
                    setupApi.getBranches(),
                ]);
                setRecords(categories.map((item: any) => ({
                    id: item.id,
                    name: item.category_name,
                    code: item.category_name.slice(0, 4).toUpperCase(),
                    description: item.category_description || '',
                    is_active: item.is_active,
                    sort_order: item.category_sort_order || 0,
                    branchAvailability: item.branchAvailability || {},
                })));
                setBranches(branchItems.map((branch: any) => ({
                    id: String(branch.id),
                    name: branch.branch_name,
                    code: branch.branch_code,
                })));
            } catch (error) {
                console.error('Failed to load menu categories', error);
                toast.error('Menu Categories', 'Could not load menu categories.');
            }
        };

        void load();
    }, []);

    return (
        <MenuMasterPage
            title="Menu Categories"
            description="Manage high-level menu categories used for catalog organization."
            icon={<Layers size={24} />}
            initialData={records}
            branches={branches}
            onSave={async (record) => {
                const payload = {
                    category_name: record.name,
                    category_description: record.description,
                    category_sort_order: record.sort_order || 0,
                    branchAvailability: record.branchAvailability,
                };
                const saved: any = record.id
                    ? await catalogApi.updateCategory(record.id, payload)
                    : await catalogApi.createCategory(payload);
                return {
                    id: saved.id,
                    name: saved.category_name,
                    code: saved.category_name.slice(0, 4).toUpperCase(),
                    description: saved.category_description || '',
                    is_active: saved.is_active,
                    sort_order: saved.category_sort_order || 0,
                    branchAvailability: saved.branchAvailability || {},
                } satisfies MasterRecord;
            }}
            onDelete={async (id) => { await catalogApi.deleteCategory(id); }}
        />
    );
}
