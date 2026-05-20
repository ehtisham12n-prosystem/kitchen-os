/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Layers, Plus, Edit2, Lock, Save, X,
    Package, Wrench, Server, ShoppingBag, Cpu, Archive,
    ChevronRight, Info, Search
} from 'lucide-react';

import styles from './InventoryClassification.module.css';
import { KitchenTable, type ColumnDef } from '../../../components/ui/KitchenTable/KitchenTable';
import { KitchenInput } from '../../../components/ui/KitchenInput/KitchenInput';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { KitchenSelect } from '../../../components/ui/KitchenSelect/KitchenSelect';
import { KitchenCard } from '../../../components/ui/KitchenCard/KitchenCard';
import { inventoryApi } from '../../../api/api';
import { toast } from '../../../components/ui/KitchenToast/toast';

interface Classification {
    id: number;
    code: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    systemSeeded: boolean;
    inUse: boolean;
    itemCount: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
    package: Package, archive: Archive, wrench: Wrench,
    server: Server, 'shopping-bag': ShoppingBag, cpu: Cpu,
};

const COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#8b5cf6'];

const BLANK_DRAFT = {
    code: '', name: '', icon: 'package', color: '#6366f1', description: '',
};

function makeCode(name: string) {
    return name
        .split(/\s+/)
        .map((part) => part[0] || '')
        .join('')
        .slice(0, 6)
        .toUpperCase();
}

function mapHierarchyToClasses(hierarchy: any[]): Classification[] {
    return hierarchy.map((entry) => {
        const itemCount = (entry.types || []).reduce((sum: number, type: any) => (
            sum + (type.subTypes || []).reduce((subSum: number, subType: any) => subSum + (subType.items?.length || 0), 0)
        ), 0);

        return {
            id: entry.id,
            code: makeCode(entry.class_name || 'CLS'),
            name: entry.class_name,
            icon: 'package',
            color: COLORS[entry.id % COLORS.length],
            description: entry.class_description || '',
            systemSeeded: false,
            inUse: itemCount > 0,
            itemCount,
        };
    });
}

export function InventoryClassification() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams();
    const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';

    const [classifications, setClassifications] = useState<Classification[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [draft, setDraft] = useState(BLANK_DRAFT);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadHierarchy = useCallback(async () => {
        setLoading(true);
        try {
            const hierarchy = await inventoryApi.getHierarchy();
            setClassifications(mapHierarchyToClasses(hierarchy));
        } catch (error: any) {
            toast.error('Load Failed', error.message || 'Could not load inventory classifications.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadHierarchy();
    }, [loadHierarchy]);

    const filteredData = useMemo(() => {
        return classifications.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.code.toLowerCase().includes(searchQuery.toLowerCase()),
        );
    }, [classifications, searchQuery]);

    const handleEdit = (cls: Classification) => {
        setEditingId(cls.id);
        setDraft({
            code: cls.code,
            name: cls.name,
            icon: cls.icon,
            color: cls.color,
            description: cls.description,
        });
        setShowAddForm(true);
    };

    const handleSave = async () => {
        if (!draft.name.trim()) {
            toast.error('Validation Error', 'Classification name is required.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                class_name: draft.name.trim(),
                class_description: draft.description.trim() || undefined,
            };

            if (editingId) {
                await inventoryApi.updateClass(editingId, payload);
                toast.success('Updated', 'Classification updated successfully.');
            } else {
                await inventoryApi.createClass(payload);
                toast.success('Created', 'Classification created successfully.');
            }

            setShowAddForm(false);
            setEditingId(null);
            setDraft(BLANK_DRAFT);
            await loadHierarchy();
        } catch (error: any) {
            toast.error('Save Failed', error.message || 'Could not save classification.');
        } finally {
            setSaving(false);
        }
    };

    const columns: ColumnDef<Classification>[] = [
        {
            key: 'code',
            header: 'Code',
            width: '100px',
            cell: (row) => (
                <div className={styles.codeCell}>
                    <div className={styles.codeBadge} style={{ borderLeft: `3px solid ${row.color}`, color: row.color }}>
                        {row.code}
                    </div>
                </div>
            )
        },
        {
            key: 'name',
            header: 'Classification Name',
            cell: (row) => {
                const Icon = ICON_MAP[row.icon] || Package;
                return (
                    <div className={styles.nameCell}>
                        <div className={styles.iconWrap} style={{ background: `${row.color}15`, color: row.color }}>
                            <Icon size={18} />
                        </div>
                        <span className={styles.clsName}>{row.name}</span>
                    </div>
                );
            }
        },
        {
            key: 'description',
            header: 'Description',
            cell: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{row.description || '—'}</span>
        },
        {
            key: 'usage',
            header: 'Usage',
            width: '160px',
            cell: (row) => (
                <div className={styles.usageCell}>
                    <span className={styles.itemCount}>{row.itemCount} items</span>
                    <span className={`${styles.statusBadge} ${row.inUse ? styles.statusInUse : styles.statusIdle}`}>
                        {row.inUse ? 'In Use' : 'Idle'}
                    </span>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Type',
            width: '120px',
            cell: (row) => row.systemSeeded ? (
                <span className={`${styles.statusBadge} ${styles.systemBadge}`}>
                    <Lock size={12} /> System
                </span>
            ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Custom</span>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '180px',
            cell: (row) => (
                <div className={styles.actions}>
                    <KitchenButton size="sm" variant="ghost" onClick={() => handleEdit(row)} title="Edit">
                        <Edit2 size={14} />
                    </KitchenButton>
                    <KitchenButton
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`${consoleBase}/inventory/setup/categories?cls=${row.id}`)}
                    >
                        Categories <ChevronRight size={14} />
                    </KitchenButton>
                </div>
            )
        }
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Layers size={20} color="var(--accent-primary)" />
                        <h1>Inventory Classifications</h1>
                    </div>
                    <p className={styles.subtitle}>High-level behavior grouping for inventory items</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <KitchenInput
                        placeholder="Search classifications..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        icon={<Search size={14} />}
                        containerClassName={styles.searchBox}
                    />
                    <KitchenButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                            setEditingId(null);
                            setDraft(BLANK_DRAFT);
                            setShowAddForm(true);
                        }}
                    >
                        <Plus size={16} /> New Classification
                    </KitchenButton>
                </div>
            </header>

            <div className={styles.infoBanner}>
                <Info size={14} />
                <span>Classification is the <strong>behaviour layer</strong>. Active inventory usage is loaded from the real master hierarchy.</span>
            </div>

            {showAddForm && (
                <div style={{ marginBottom: '16px' }}>
                    <KitchenCard
                        title={editingId ? 'Edit Classification' : 'New Classification'}
                        noPadding
                        extra={
                            <KitchenButton variant="ghost" size="sm" onClick={() => setShowAddForm(false)} style={{ padding: '4px' }}>
                                <X size={16} />
                            </KitchenButton>
                        }
                        footer={
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
                                <KitchenButton variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</KitchenButton>
                                <KitchenButton variant="primary" size="sm" onClick={handleSave} isLoading={saving}>
                                    <Save size={14} style={{ marginRight: '6px' }} /> {editingId ? 'Update' : 'Create'}
                                </KitchenButton>
                            </div>
                        }
                    >
                        <div className={styles.formBody}>
                            <div className={styles.formGrid}>
                                <KitchenInput
                                    label="Code"
                                    value={draft.code}
                                    onChange={e => setDraft(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                    placeholder="Auto-generated from name"
                                    disabled
                                />
                                <KitchenInput
                                    label="Name"
                                    value={draft.name}
                                    onChange={e => setDraft(p => ({ ...p, name: e.target.value, code: makeCode(e.target.value) }))}
                                    placeholder="e.g. Raw Material"
                                />
                                <KitchenSelect
                                    label="Icon"
                                    value={draft.icon}
                                    onChange={e => setDraft(p => ({ ...p, icon: e.target.value }))}
                                    options={Object.keys(ICON_MAP).map(k => ({ label: k.charAt(0).toUpperCase() + k.slice(1), value: k }))}
                                />
                                <div className={styles.colorPicker}>
                                    <label>Color Accent</label>
                                    <div className={styles.colorRow}>
                                        {COLORS.map(c => (
                                            <div
                                                key={c}
                                                className={`${styles.colorSwatch} ${draft.color === c ? styles.colorActive : ''}`}
                                                style={{ background: c, color: c }}
                                                onClick={() => setDraft(p => ({ ...p, color: c }))}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <KitchenInput
                                        label="Description"
                                        value={draft.description}
                                        onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Briefly describe what this classification covers"
                                    />
                                </div>
                            </div>
                        </div>
                    </KitchenCard>
                </div>
            )}

            <KitchenTable
                columns={columns}
                data={filteredData}
                className={styles.compactTable}
                emptyMessage={loading ? 'Loading classifications...' : 'No classifications found matching your search.'}
            />
        </div>
    );
}
