/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Soup } from 'lucide-react';
import { MenuMasterPage, type MasterRecord } from './MenuMasterPage';
import { catalogApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';

export function CuisineTypes() {
    const [records, setRecords] = useState<MasterRecord[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const cuisines = await catalogApi.getCuisineTypes();
                setRecords(cuisines.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    code: item.code || item.name.slice(0, 4).toUpperCase(),
                    description: item.description || '',
                    is_active: item.is_active,
                    sort_order: item.sort_order || 0,
                })));
            } catch (error) {
                console.error('Failed to load cuisine types', error);
                toast.error('Cuisine Types', 'Could not load cuisine classifications.');
            }
        };

        void load();
    }, []);

    return (
        <MenuMasterPage
            title="Cuisine Types"
            description="Manage cuisine classifications for reporting and customer filtering."
            icon={<Soup size={24} />}
            initialData={records}
            onSave={async (record) => {
                const payload = {
                    name: record.name,
                    description: record.description,
                };
                const saved: any = record.id
                    ? await catalogApi.updateCuisineType(record.id, payload)
                    : await catalogApi.createCuisineType(payload);
                return {
                    id: saved.id,
                    name: saved.name,
                    code: saved.name.slice(0, 4).toUpperCase(),
                    description: saved.description || '',
                    is_active: saved.is_active,
                    sort_order: saved.sort_order || 0,
                } satisfies MasterRecord;
            }}
            onDelete={async (id) => { await catalogApi.deleteCuisineType(id); }}
        />
    );
}
