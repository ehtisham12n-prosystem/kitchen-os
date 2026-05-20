/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { ChefHat } from 'lucide-react';
import { MenuMasterPage, type MasterRecord } from './MenuMasterPage';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { catalogApi, setupApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './PrepStations.module.css';

export function PrepStations() {
    const [records, setRecords] = useState<MasterRecord[]>([]);
    const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [stations, branchItems] = await Promise.all([
                    catalogApi.getStations(),
                    setupApi.getBranches(),
                ]);
                setRecords(stations.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    code: item.code || '',
                    description: item.description || '',
                    is_active: item.is_active,
                    sort_order: item.kitchen_display_order || 0,
                    kitchen_display_order: item.kitchen_display_order || 0,
                    supports_hot_food: item.supports_hot_food,
                    supports_cold_food: item.supports_cold_food,
                    branchAvailability: item.branchAvailability || {},
                })));
                setBranches(branchItems.map((branch: any) => ({
                    id: String(branch.id),
                    name: branch.branch_name,
                    code: branch.branch_code,
                })));
            } catch (error) {
                console.error('Failed to load prep stations', error);
                toast.error('Prep Stations', 'Could not load preparation stations.');
            }
        };

        void load();
    }, []);

    const renderExtraFields = (record: any, onChange: (field: string, value: any) => void) => (
        <>
            <KitchenInput
                label="KDS Order"
                type="number"
                value={record.kitchen_display_order || 0}
                onChange={(e) => onChange('kitchen_display_order', parseInt(e.target.value || '0', 10))}
            />
            <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={record.supports_hot_food || false}
                        onChange={(e) => onChange('supports_hot_food', e.target.checked)}
                    />
                    Supports Hot Food
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={record.supports_cold_food || false}
                        onChange={(e) => onChange('supports_cold_food', e.target.checked)}
                    />
                    Supports Cold Food
                </label>
            </div>
        </>
    );

    return (
        <MenuMasterPage
            title="Prep Stations"
            description="Configure kitchen stations and their routing logic."
            icon={<ChefHat size={24} />}
            initialData={records}
            branches={branches}
            extraFields={renderExtraFields}
            onSave={async (record) => {
                const payload = {
                    name: record.name,
                    code: record.code,
                    description: record.description,
                    is_active: record.is_active,
                    kitchen_display_order: record.kitchen_display_order || 0,
                    supports_hot_food: record.supports_hot_food || false,
                    supports_cold_food: record.supports_cold_food || false,
                    branchAvailability: record.branchAvailability,
                };
                const saved: any = record.id
                    ? await catalogApi.updateStation(record.id, payload)
                    : await catalogApi.createStation(payload);
                return {
                    id: saved.id,
                    name: saved.name,
                    code: saved.code || '',
                    description: saved.description || '',
                    is_active: saved.is_active,
                    sort_order: saved.kitchen_display_order || 0,
                    kitchen_display_order: saved.kitchen_display_order || 0,
                    supports_hot_food: saved.supports_hot_food,
                    supports_cold_food: saved.supports_cold_food,
                    branchAvailability: saved.branchAvailability || {},
                } satisfies MasterRecord;
            }}
            onDelete={async (id) => { await catalogApi.deleteStation(id); }}
        />
    );
}
