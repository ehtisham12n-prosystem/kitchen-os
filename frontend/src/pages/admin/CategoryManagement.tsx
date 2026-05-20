/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { Plus, ChevronRight, FolderTree, X, Edit, Trash2, Save } from 'lucide-react';
import { catalogApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './Admin.module.css';

interface Category {
    id: number;
    name: string;
    parent: string | null;
    sort_order: number;
    productCount: number;
}

export function CategoryManagement() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const [formName, setFormName] = useState('');
    const [formParent, setFormParent] = useState('');
    const [formSortOrder, setFormSortOrder] = useState('');

    const rootCategories = useMemo(
        () => categories.filter(c => c.parent === null && (!editingCategory || c.id !== editingCategory.id)),
        [categories, editingCategory],
    );

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const [categoryData, productData] = await Promise.all([
                    catalogApi.getCategories(),
                    catalogApi.getProducts(),
                ]);

                setCategories(categoryData.map((category: any) => ({
                    id: category.id,
                    name: category.category_name,
                    parent: categoryData.find((candidate: any) => candidate.id === category.parent_category_id)?.category_name || null,
                    sort_order: category.category_sort_order || 0,
                    productCount: productData.filter((product: any) => product.category_id === category.id).length,
                })));
            } catch (error) {
                console.error('Failed to load categories:', error);
                toast.error('Catalog Error', 'Could not load categories.');
            }
        };

        fetchCategories();
    }, []);

    const columns: ColumnDef<Category>[] = [
        {
            key: 'name',
            header: 'Category Hierarchy',
            cell: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {row.parent && <ChevronRight size={12} style={{ marginLeft: '12px', color: 'var(--text-tertiary)' }} />}
                    <div style={{ 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: row.parent ? 'transparent' : 'var(--accent-primary-transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: row.parent ? 'var(--text-tertiary)' : 'var(--accent-primary)'
                    }}>
                        <FolderTree size={14} />
                    </div>
                    <span style={{ 
                        fontWeight: row.parent ? 500 : 700,
                        fontSize: '0.9rem',
                        color: row.parent ? 'var(--text-secondary)' : 'var(--text-primary)'
                    }}>{row.name}</span>
                </div>
            )
        },
        {
            key: 'parent',
            header: 'Parent Category',
            cell: (row) => (
                <span style={{ 
                    fontSize: '0.85rem', 
                    color: row.parent ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                    background: row.parent ? 'var(--accent-primary-transparent)' : 'transparent',
                    padding: row.parent ? '2px 8px' : '0',
                    borderRadius: '4px',
                }}>
                    {row.parent || '—'}
                </span>
            )
        },
        {
            key: 'sort_order',
            header: 'Sort',
            width: '80px',
            cell: (row) => (
                <div style={{ textAlign: 'center', fontWeight: 'bold', opacity: 0.7 }}>
                    #{row.sort_order}
                </div>
            )
        },
        {
            key: 'productCount',
            header: 'Products',
            width: '100px',
            align: 'center',
            cell: (row) => (
                <span className="kitchen-badge-info" style={{ borderRadius: '6px' }}>
                    {row.productCount} Items
                </span>
            )
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '120px',
            cell: (row) => (
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <KitchenButton 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => handleEditClick(row)}
                        style={{ padding: '4px 8px', height: '28px' }}
                    >
                        <Edit size={14} />
                        Manage
                    </KitchenButton>
                </div>
            )
        }
    ];

    function handleEditClick(cat: Category) {
        setEditingCategory(cat);
        setFormName(cat.name);
        setFormParent(cat.parent || '');
        setFormSortOrder(String(cat.sort_order));
        setShowModal(true);
    }

    function openModal() {
        setEditingCategory(null);
        setFormName('');
        setFormParent('');
        setFormSortOrder(String(categories.length + 1));
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setEditingCategory(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) return;

        try {
            const parentCategory = categories.find(c => c.name === formParent.trim());
            const payload = {
                category_name: formName.trim(),
                parent_category_id: parentCategory?.id,
                category_sort_order: parseInt(formSortOrder) || categories.length + 1,
            };

            const saved: any = editingCategory
                ? await catalogApi.updateCategory(editingCategory.id, payload)
                : await catalogApi.createCategory(payload);

            const nextCategory: Category = {
                id: saved.id,
                name: saved.category_name,
                parent: categories.find(c => c.id === saved.parent_category_id)?.name || null,
                sort_order: saved.category_sort_order || 0,
                productCount: editingCategory?.productCount || 0,
            };

            if (editingCategory) {
                setCategories(prev => prev.map(c => c.id === editingCategory.id ? nextCategory : c));
                toast.success('Category Updated', 'Category saved successfully.');
            } else {
                setCategories(prev => [...prev, nextCategory]);
                toast.success('Category Created', 'Category added successfully.');
            }
        } catch (error: any) {
            console.error('Failed to save category:', error);
            toast.error('Save Failed', error.message || 'Could not save category.');
            return;
        }
        closeModal();
    }

    async function handleDelete() {
        if (!editingCategory) return;
        if (window.confirm(`Are you sure you want to delete "${editingCategory.name}"?`)) {
            try {
                await catalogApi.deleteCategory(editingCategory.id);
                setCategories(prev => prev.filter(c => c.id !== editingCategory.id));
                toast.success('Category Deleted', 'Category removed successfully.');
                closeModal();
            } catch (error: any) {
                console.error('Failed to delete category:', error);
                toast.error('Delete Failed', error.message || 'Could not delete category.');
            }
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1>Category Architecture</h1>
                    <p>Hierarchical organization for menu and inventory items.</p>
                </div>
                <KitchenButton size="sm" onClick={openModal}>
                    <Plus size={16} style={{ marginRight: '6px' }} />
                    Add Category
                </KitchenButton>
            </header>

            <KitchenCard className={styles.tableCard}>
                <KitchenTable 
                    columns={columns} 
                    data={categories} 
                    compact
                />
            </KitchenCard>

            {/* Add/Edit Category Modal */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingCategory ? 'Modify Category' : 'New Category'}</h2>
                            <button className={styles.modalClose} onClick={closeModal}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className={styles.modalForm}>
                            <div className={styles.formGroup}>
                                <label htmlFor="cat-name">Category Name <span className={styles.required}>*</span></label>
                                <input
                                    id="cat-name"
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="e.g. Desserts"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className={styles.branchGrid}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="cat-parent">Parent Category</label>
                                    <select
                                        id="cat-parent"
                                        className={styles.formInput}
                                        value={formParent}
                                        onChange={e => setFormParent(e.target.value)}
                                    >
                                        <option value="">— Top-level —</option>
                                        {rootCategories.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="cat-sort">Sort Order</label>
                                    <input
                                        id="cat-sort"
                                        type="number"
                                        className={styles.formInput}
                                        placeholder="e.g. 1"
                                        value={formSortOrder}
                                        onChange={e => setFormSortOrder(e.target.value)}
                                        min={1}
                                    />
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                {editingCategory && (
                                    <KitchenButton 
                                        type="button" 
                                        variant="danger" 
                                        onClick={handleDelete}
                                        style={{ marginRight: 'auto' }}
                                    >
                                        <Trash2 size={14} />
                                    </KitchenButton>
                                )}
                                <KitchenButton type="button" variant="secondary" size="sm" onClick={closeModal}>
                                    Discard
                                </KitchenButton>
                                <KitchenButton type="submit" size="sm">
                                    {editingCategory ? <Save size={16} style={{ marginRight: '6px' }} /> : <Plus size={16} style={{ marginRight: '6px' }} />}
                                    {editingCategory ? 'Update' : 'Create Category'}
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
