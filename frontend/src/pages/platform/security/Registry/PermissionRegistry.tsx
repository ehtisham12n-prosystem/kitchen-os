import React, { useState } from 'react';
import {
    Plus,
    LayoutGrid,
    Boxes,
    Key,
    Edit3,
    Database,
    Zap,
    Lock,
    X,
    Save,
    AlertTriangle,
    Shield,
    CheckCircle2,
    ChevronRight,
    Search,
    ShoppingCart,
    Package,
    Utensils,
    Smartphone,
    Activity
} from 'lucide-react';
import styles from './PermissionRegistry.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PagePermissionTemplate {
    id: string;
    name: string;
    description: string;
    actions: string[]; // Flexible strings for custom buttons/actions
}

interface ModuleRegistry {
    id: string;
    name: string;
    icon: any;
    description: string;
    pages: PagePermissionTemplate[];
}

interface GroupTemplate {
    id: string;
    name: string;
    description: string;
    type: 'standard' | 'minimal' | 'executive';
    moduleCount: number;
    permissionCount: number;
    selectedPermissions: string[]; // List of unique permission IDs: "module_id.page_id.action"
}

// ─── Initial Data (The "Registry") ──────────────────────────────────────────

const INITIAL_REGISTRY: ModuleRegistry[] = [
    {
        id: 'nexus_clients',
        name: 'Client Management',
        icon: Boxes,
        description: 'Manage tenants, branches, and subscription lifecycle.',
        pages: [
            { id: 'client_list', name: 'Client Directory', description: 'View all active and inactive clients.', actions: ['read', 'create', 'update', 'delete', 'export'] },
            { id: 'client_detail', name: 'Client Deep-Dive', description: 'Manage specific client branches and users.', actions: ['read', 'update', 'impersonate'] },
            { id: 'client_onboarding', name: 'Onboarding Wizard', description: 'Step-by-step setup for new clients.', actions: ['create', 'update'] }
        ]
    },
    {
        id: 'nexus_users',
        name: 'System User Control',
        icon: Shield,
        description: 'Internal platform administrators and support staff.',
        pages: [
            { id: 'user_list', name: 'Platform Users', description: 'Manage Nexus portal access.', actions: ['read', 'create', 'update', 'delete'] },
            { id: 'user_logs', name: 'Login Audit', description: 'Track platform login attempts.', actions: ['read', 'export'] }
        ]
    },
    {
        id: 'nexus_security',
        name: 'Security & RBAC',
        icon: Key,
        description: 'Define roles, groups, and permission registry.',
        pages: [
            { id: 'role_mgmt', name: 'Role Management', description: 'Define horizontal access roles.', actions: ['read', 'create', 'update', 'delete'] },
            { id: 'group_mgmt', name: 'Group Management', description: 'Define vertical functional groups.', actions: ['read', 'create', 'update', 'delete'] },
            { id: 'perm_registry', name: 'Permission Registry', description: 'Canonical list of all system rights.', actions: ['read', 'update', 'sync'] }
        ]
    },
    {
        id: 'nexus_finance',
        name: 'Finance & Invoices',
        icon: ShoppingCart,
        description: 'Automated billing and invoice tracking.',
        pages: [
            { id: 'invoice_list', name: 'Invoices', description: 'Track platform-wide revenue.', actions: ['read', 'create', 'refund', 'export'] }
        ]
    },
    {
        id: 'nexus_infrastructure',
        name: 'Infrastructure & Themes',
        icon: LayoutGrid,
        description: 'Manage design system, themes, and global settings.',
        pages: [
            { id: 'theme_library', name: 'Theme Library', description: 'Manage global UI presets.', actions: ['read', 'create', 'update', 'publish'] },
            { id: 'org_settings', name: 'Organization Settings', description: 'Global meta data and API keys.', actions: ['read', 'update'] }
        ]
    },
    {
        id: 'nexus_subscription',
        name: 'Subscription Master',
        icon: Package,
        description: 'Define SaaS plans and billing groups.',
        pages: [
            { id: 'sub_plans', name: 'Package Groups', description: 'Global plan hierarchy.', actions: ['read', 'create', 'update', 'delete'] },
            { id: 'addons', name: 'Add-on Definitions', description: 'Optional features registry.', actions: ['read', 'create', 'update'] }
        ]
    },
    {
        id: 'nexus_menu_standards',
        name: 'Menu Standards',
        icon: Utensils,
        description: 'Global master data for menu architectural objects.',
        pages: [
            { id: 'menu_cat', name: 'Global Categories', description: 'Master catalog taxonomy.', actions: ['read', 'update'] },
            { id: 'cuisine_types', name: 'Cuisine Types', description: 'Cultural cuisines categorization.', actions: ['read', 'update'] }
        ]
    },
    {
        id: 'nexus_ops_logs',
        name: 'Operations & Audit',
        icon: Activity,
        description: 'Platform broadcast systems and system-wide logs.',
        pages: [
            { id: 'broadcasts', name: 'Global Announcements', description: 'Broadcast events to all clients.', actions: ['read', 'create', 'delete'] },
            { id: 'audit_logs', name: 'System Audit', description: 'Deep security forensic logs.', actions: ['read', 'export'] },
            { id: 'radar', name: 'Usage Radar', description: 'Real-time performance metrics.', actions: ['read'] }
        ]
    }
];

const INITIAL_TEMPLATES: GroupTemplate[] = [
    {
        id: 'nexus_super_admin',
        name: 'Nexus Super Admin',
        description: 'Unlimited access to all platform features and master data.',
        type: 'executive',
        moduleCount: 8,
        permissionCount: 35,
        selectedPermissions: []
    },
    {
        id: 'nexus_support_lead',
        name: 'Support Operations',
        description: 'Access to client data, logs, and impersonation for troubleshooting.',
        type: 'standard',
        moduleCount: 4,
        permissionCount: 15,
        selectedPermissions: []
    },
    {
        id: 'nexus_billing_mgmt',
        name: 'Billing Manager',
        description: 'Control over subscriptions, invoices, and financial reporting.',
        type: 'standard',
        moduleCount: 2,
        permissionCount: 8,
        selectedPermissions: []
    }
];

const ICON_MAP = {
    'LayoutGrid': LayoutGrid,
    'ShoppingCart': ShoppingCart,
    'Boxes': Boxes,
    'Smartphone': Smartphone,
    'Utensils': Utensils,
    'Package': Package,
    'Shield': Shield,
    'Database': Database,
    'Key': Key
};

const STANDARD_ACTIONS = ['read', 'create', 'update', 'delete', 'audit'];

import { useEffect } from 'react';
import { platformApi, systemGroupApi } from '../../../../api/api';

export const PermissionRegistry: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'modules' | 'templates'>('modules');
    const [registry, setRegistry] = useState<ModuleRegistry[]>(INITIAL_REGISTRY);
    const [templates, setTemplates] = useState<GroupTemplate[]>(INITIAL_TEMPLATES);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchRegistry = async () => {
            setIsLoading(true);
            try {
                // getNexusRegistry() returns ONLY nexus_ prefixed modules — never Console modules
                const [data, groupData] = await Promise.all([
                    platformApi.getNexusRegistry(),
                    systemGroupApi.getGroups(),
                ]);

                if (data && data.length > 0) {
                    const mapped = data.map((mod: any) => ({
                        id: mod.slug || mod.id,
                        name: mod.name,
                        icon: ICON_MAP[mod.icon as keyof typeof ICON_MAP] || LayoutGrid,
                        description: mod.description,
                        pages: (mod.pages || []).map((p: any) => ({
                            id: p.slug || p.id,
                            name: p.name,
                            description: p.description,
                            actions: p.actions || []
                        }))
                    }));
                    setRegistry(mapped);
                }

                const nexusTemplates = (groupData || [])
                    .filter((group: any) => group.scope === 'nexus' && group.is_template)
                    .map((group: any) => {
                        const selectedPermissions = Array.isArray(group.permissions) ? group.permissions : [];
                        const moduleCount = selectedPermissions.includes('all')
                            ? (data?.length || INITIAL_REGISTRY.length)
                            : new Set(
                                selectedPermissions
                                    .map((permission: string) => String(permission || '').split('.')[0])
                                    .filter(Boolean),
                            ).size;
                        const loweredName = String(group.name || '').toLowerCase();
                        const type: GroupTemplate['type'] = selectedPermissions.includes('all') || loweredName.includes('super admin')
                            ? 'executive'
                            : selectedPermissions.length <= 6
                                ? 'minimal'
                                : 'standard';

                        return {
                            id: group.id,
                            name: group.name,
                            description: group.description || 'Nexus permission template.',
                            type,
                            moduleCount,
                            permissionCount: selectedPermissions.includes('all') ? 0 : selectedPermissions.length,
                            selectedPermissions,
                        };
                    });

                if (nexusTemplates.length > 0) {
                    setTemplates(nexusTemplates);
                }
            } catch (error) {
                console.error('Failed to fetch registry:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRegistry();
    }, []);

    // Sidebar Selection
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(registry.length > 0 ? registry[0].id : null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates.length > 0 ? templates[0].id : null);

    // Initial item selection sync
    useEffect(() => {
        if (!selectedModuleId && registry.length > 0) setSelectedModuleId(registry[0].id);
        if (!selectedTemplateId && templates.length > 0) setSelectedTemplateId(templates[0].id);
    }, [registry, templates]);

    const [showInlineCreate, setShowInlineCreate] = useState(false);

    // Modal State
    const [showPageModal, setShowPageModal] = useState(false);
    const [showConfigureModal, setShowConfigureModal] = useState(false);
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeTemplate, setActiveTemplate] = useState<GroupTemplate | null>(null);
    const [configFilter, setConfigFilter] = useState('');

    // Form State (Module)
    const [moduleForm, setModuleForm] = useState({
        name: '',
        description: '',
        iconName: 'LayoutGrid'
    });

    // Form State (Page)
    const [pageForm, setPageForm] = useState({
        name: '',
        description: '',
        actions: [...STANDARD_ACTIONS],
        customActionInput: ''
    });

    const getPermId = (modId: string, pageId: string, action: string) => `${modId}.${pageId}.${action}`;

    const handleAddModule = async () => {
        if (!moduleForm.name) return;

        try {
            // In a real app, this would be platformApi.createRegistryModule
            const newId = moduleForm.name.toLowerCase().replace(/\s+/g, '_');
            const newModule: ModuleRegistry = {
                id: newId,
                name: moduleForm.name,
                description: moduleForm.description,
                icon: ICON_MAP[moduleForm.iconName as keyof typeof ICON_MAP] || Boxes,
                pages: []
            };

            setRegistry([...registry, newModule]);
            setModuleForm({ name: '', description: '', iconName: 'Boxes' });
            setShowInlineCreate(false);
        } catch (error) {
            console.error('Failed to create module:', error);
        }
    };

    const handleAddPage = () => {
        if (!activeModuleId) return;

        const newPage: PagePermissionTemplate = {
            id: pageForm.name.toLowerCase().replace(/\s+/g, '_'),
            name: pageForm.name,
            description: pageForm.description,
            actions: pageForm.actions
        };

        setRegistry(registry.map(mod =>
            mod.id === activeModuleId
                ? { ...mod, pages: [...mod.pages, newPage] }
                : mod
        ));

        setShowPageModal(false);
        setPageForm({ name: '', description: '', actions: [...STANDARD_ACTIONS], customActionInput: '' });
    };

    const togglePageAction = (action: string) => {
        setPageForm(prev => ({
            ...prev,
            actions: prev.actions.includes(action)
                ? prev.actions.filter(a => a !== action)
                : [...prev.actions, action]
        }));
    };

    const addCustomAction = () => {
        const action = pageForm.customActionInput.trim().toLowerCase().replace(/\s+/g, '_');
        if (action && !pageForm.actions.includes(action)) {
            setPageForm(prev => ({
                ...prev,
                actions: [...prev.actions, action],
                customActionInput: ''
            }));
        }
    };

    const removeActionFromPage = (action: string) => {
        setPageForm(prev => ({
            ...prev,
            actions: prev.actions.filter(a => a !== action)
        }));
    };

    const handleConfigureTemplate = (template: GroupTemplate) => {
        setActiveTemplate(template);
        setShowConfigureModal(true);
    };

    const toggleTemplatePermission = (permId: string) => {
        if (!activeTemplate) return;

        const isSelected = activeTemplate.selectedPermissions.includes(permId);
        const newSelected = isSelected
            ? activeTemplate.selectedPermissions.filter(p => p !== permId)
            : [...activeTemplate.selectedPermissions, permId];

        setActiveTemplate({
            ...activeTemplate,
            selectedPermissions: newSelected
        });
    };

    const saveTemplateConfiguration = () => {
        if (!activeTemplate) return;
        const uniqueModules = new Set(activeTemplate.selectedPermissions.map(p => p.split('.')[0]));

        setTemplates(templates.map(t =>
            t.id === activeTemplate.id
                ? {
                    ...activeTemplate,
                    moduleCount: uniqueModules.size,
                    permissionCount: activeTemplate.selectedPermissions.length
                }
                : t
        ));

        setShowConfigureModal(false);
        setActiveTemplate(null);
        setConfigFilter('');
    };

    const getHeaderColor = (id: string) => {
        const index = registry.findIndex(m => m.id === id);
        const colors = [styles.headerBlue, styles.headerPurple, styles.headerTeal, styles.headerIndigo];
        return colors[index % colors.length] || colors[0];
    };

    const selectedModule = registry.find(m => m.id === selectedModuleId);
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    return (
        <div className={styles.registryContainer}>
            <header className={styles.registryHeader}>
                <div className={styles.headerTitle}>
                    <h1><Database size={24} color="var(--accent-primary)" /> Permission Registry</h1>
                    <p>Building the link between <strong>Modules</strong>, <strong>Pages</strong>, and <strong>Button Actions</strong>.</p>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.tabSwitcherRow}>
                        <button
                            className={`${styles.tabToggle} ${activeTab === 'modules' ? styles.tabToggleActive : ''}`}
                            onClick={() => setActiveTab('modules')}
                            title="Switch to Modules"
                        >
                            <Boxes size={16} />
                            <span>Modules</span>
                        </button>
                        <button
                            className={`${styles.tabToggle} ${activeTab === 'templates' ? styles.tabToggleActive : ''}`}
                            onClick={() => setActiveTab('templates')}
                            title="Switch to Templates"
                        >
                            <Shield size={16} />
                            <span>Templates</span>
                        </button>
                    </div>

                    <button className={styles.createButton} onClick={() => setShowInlineCreate(!showInlineCreate)}>
                        {showInlineCreate ? <X size={18} /> : <Plus size={18} />}
                        {activeTab === 'modules' ? 'Define Module' : 'Create Template'}
                    </button>
                </div>
            </header>

            {showInlineCreate && (
                <section className={styles.creationSection}>
                    <div className={styles.creationForm}>
                        <div className={styles.formGroup}>
                            <label>Name</label>
                            <input
                                className={styles.input}
                                placeholder={activeTab === 'modules' ? "Module Name..." : "Template Name..."}
                                value={activeTab === 'modules' ? moduleForm.name : ''}
                                onChange={e => activeTab === 'modules' ? setModuleForm({ ...moduleForm, name: e.target.value }) : null}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Description</label>
                            <input
                                className={styles.input}
                                placeholder="Summary of scope..."
                                value={activeTab === 'modules' ? moduleForm.description : ''}
                                onChange={e => activeTab === 'modules' ? setModuleForm({ ...moduleForm, description: e.target.value }) : null}
                            />
                        </div>
                        {activeTab === 'modules' ? (
                            <div className={styles.formGroup}>
                                <label>Icon</label>
                                <select
                                    className={styles.select}
                                    value={moduleForm.iconName}
                                    onChange={e => setModuleForm({ ...moduleForm, iconName: e.target.value })}
                                >
                                    {Object.keys(ICON_MAP).map(icon => <option key={icon} value={icon}>{icon}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className={styles.formGroup}>
                                <label>Template Type</label>
                                <select className={styles.select}>
                                    <option value="standard">Standard</option>
                                    <option value="executive">Executive</option>
                                    <option value="minimal">Minimal</option>
                                </select>
                            </div>
                        )}
                        <div className={styles.formGroup}>
                            <button className={styles.createButton} onClick={activeTab === 'modules' ? handleAddModule : undefined} style={{ width: '100%' }}>
                                <Save size={18} /> Save {activeTab === 'modules' ? 'Module' : 'Template'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            <main className={styles.mainGrid}>
                {/* ── Left Sidebar (20%) ── */}
                <aside className={styles.leftSidebar}>
                    {activeTab === 'modules' ? (
                        registry.map(module => (
                            <div
                                key={module.id}
                                className={`${styles.sidebarItem} ${selectedModuleId === module.id ? styles.sidebarItemActive : ''}`}
                                onClick={() => setSelectedModuleId(module.id)}
                            >
                                <div className={styles.itemInfo}>
                                    <div className={styles.itemName}>
                                        <module.icon size={16} /> {module.name}
                                    </div>
                                    <div className={styles.itemMeta}>
                                        <code className={styles.nsBadge}>{module.id}</code>
                                        <span>{module.pages.length} Pages</span>
                                    </div>
                                </div>
                                <ChevronRight size={14} color="var(--text-tertiary)" />
                            </div>
                        ))
                    ) : (
                        templates.map(template => (
                            <div
                                key={template.id}
                                className={`${styles.sidebarItem} ${selectedTemplateId === template.id ? styles.sidebarItemActive : ''}`}
                                onClick={() => setSelectedTemplateId(template.id)}
                            >
                                <div className={styles.itemInfo}>
                                    <div className={styles.itemName}>
                                        <Lock size={16} /> {template.name}
                                    </div>
                                    <div className={styles.itemMeta}>
                                        <span className={`${styles.typeBadge} ${styles[`type${template.type.charAt(0).toUpperCase() + template.type.slice(1)}`]}`}>
                                            {template.type}
                                        </span>
                                        <span>{template.permissionCount} Perms</span>
                                    </div>
                                </div>
                                <ChevronRight size={14} color="var(--text-tertiary)" />
                            </div>
                        ))
                    )}
                </aside>

                {/* ── Right Content (80%) ── */}
                <section className={styles.rightContent}>
                    {isLoading ? (
                        <div className={styles.loadingPulse}>
                            <Database size={48} />
                            <p>Syncing Registry...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'modules' ? (
                                selectedModule ? (
                                    <div className={styles.moduleCard}>
                                        <div className={`${styles.cardHeader} ${getHeaderColor(selectedModule.id)}`}>
                                            <h3><selectedModule.icon size={18} /> {selectedModule.name} Definitions</h3>
                                            <button className={styles.iconBtn}><Edit3 size={14} /></button>
                                        </div>
                                        <div className={styles.pageList}>
                                            {selectedModule.pages.length === 0 && (
                                                <div className={styles.emptyPrompt}>
                                                    <AlertTriangle size={14} /> No pages linked yet
                                                </div>
                                            )}
                                            {selectedModule.pages.map(page => (
                                                <div key={page.id} className={styles.pageItem}>
                                                    <div className={styles.pageMeta}>
                                                        <h4>{page.name}</h4>
                                                        <code className={styles.pageKey}>{selectedModule.id}.{page.id}</code>
                                                    </div>
                                                    <div className={styles.permPills}>
                                                        {page.actions.map(action => (
                                                            <span key={action} className={styles.permPill}>{action}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                className={styles.addPageBtn}
                                                onClick={() => { setActiveModuleId(selectedModule.id); setShowPageModal(true); }}
                                            >
                                                <Plus size={14} /> Link New Page Definition
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.emptyState}>
                                        <Boxes size={64} style={{ opacity: 0.1 }} />
                                        <h3>Registry Modules</h3>
                                        <p>Select a module from the left to manage its page definitions and actions.</p>
                                    </div>
                                )
                            ) : (
                                selectedTemplate ? (
                                    <div className={styles.templateCard}>
                                        <div className={styles.templateRow}>
                                            <div className={styles.templateIcon}><Lock size={20} /></div>
                                            <div className={styles.templateMeta}>
                                                <h3>{selectedTemplate.name}</h3>
                                                <p className={styles.templateDescription}>{selectedTemplate.description}</p>
                                            </div>
                                        </div>
                                        <div className={styles.templateStats}>
                                            <div className={styles.statItem}><LayoutGrid size={14} /> {selectedTemplate.moduleCount} Modules</div>
                                            <div className={styles.statItem}><Key size={14} /> {selectedTemplate.permissionCount} Permissions</div>
                                        </div>
                                        <div className={styles.templateActions}>
                                            <button className={styles.secondaryBtn} onClick={() => handleConfigureTemplate(selectedTemplate)}>
                                                <Zap size={14} /> Configure Master Button Rights
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.emptyState}>
                                        <Shield size={64} style={{ opacity: 0.1 }} />
                                        <h3>Master Templates</h3>
                                        <p>Select a template to configure its default permission scope.</p>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </section>
            </main>

            {/* ─── MODALS ─── */}

            {showPageModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Link Page & Define Actions</h2>
                            <button className={styles.closeBtn} onClick={() => setShowPageModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Page Name</label>
                                <input className={styles.input} placeholder="e.g. Stock Ledger" value={pageForm.name} onChange={e => setPageForm({ ...pageForm, name: e.target.value })} />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Standard Operations</label>
                                <div className={styles.permCheckboxGroup}>
                                    {STANDARD_ACTIONS.map(action => (
                                        <label key={action} className={styles.checkboxLabel}>
                                            <input type="checkbox" checked={pageForm.actions.includes(action)} onChange={() => togglePageAction(action)} />
                                            {action.toUpperCase()}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Custom Actions (Buttons / Specific Rights)</label>
                                <div className={styles.customActionInputWrap}>
                                    <input
                                        className={styles.input}
                                        placeholder="Type button name (e.g. VOID_ORDER) and press Enter"
                                        value={pageForm.customActionInput}
                                        onChange={e => setPageForm({ ...pageForm, customActionInput: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && addCustomAction()}
                                    />
                                    <button className={styles.addBtn} onClick={addCustomAction}><Plus size={16} /></button>
                                </div>
                                <div className={styles.customActionTags}>
                                    {pageForm.actions.filter(a => !STANDARD_ACTIONS.includes(a)).map(action => (
                                        <span key={action} className={styles.actionTag}>
                                            {action}
                                            <X size={12} onClick={() => removeActionFromPage(action)} />
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setShowPageModal(false)}>Cancel</button>
                            <button className={styles.createButton} onClick={handleAddPage}><Save size={18} /> Link Page</button>
                        </div>
                    </div>
                </div>
            )}

            {showConfigureModal && activeTemplate && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.configModal}`}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleArea}>
                                <h2>Configure Master Template: {activeTemplate.name}</h2>
                                <p>Select which module pages and specific buttons this group can access.</p>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setShowConfigureModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.configSearch}>
                                <Search size={16} />
                                <input
                                    placeholder="Filter by module or page..."
                                    value={configFilter}
                                    onChange={e => setConfigFilter(e.target.value)}
                                />
                            </div>
                            <div className={styles.configScrollArea}>
                                {registry.filter(mod => {
                                    if (!configFilter) return true;
                                    const search = configFilter.toLowerCase();
                                    return mod.name.toLowerCase().includes(search) ||
                                        mod.pages.some(p => p.name.toLowerCase().includes(search));
                                }).map(module => (
                                    <div key={module.id} className={styles.configModuleSection}>
                                        <div className={styles.configModuleHeader}>
                                            <module.icon size={16} />
                                            <h3>{module.name}</h3>
                                        </div>
                                        <div className={styles.configPageList}>
                                            {module.pages.map(page => (
                                                <div key={page.id} className={styles.configPageItem}>
                                                    <div className={styles.configPageHeader}>
                                                        <ChevronRight size={14} />
                                                        <span>{page.name}</span>
                                                    </div>
                                                    <div className={styles.configActionGrid}>
                                                        {page.actions.map(action => {
                                                            const pId = getPermId(module.id, page.id, action);
                                                            const isChecked = activeTemplate.selectedPermissions.includes(pId);
                                                            return (
                                                                <button key={action} className={`${styles.configActionBtn} ${isChecked ? styles.activeAction : ''}`} onClick={() => toggleTemplatePermission(pId)}>
                                                                    {isChecked && <CheckCircle2 size={12} />}
                                                                    {action}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <div className={styles.selectionSummary}>Active: {activeTemplate.selectedPermissions.length} Rights</div>
                            <button className={styles.createButton} onClick={saveTemplateConfiguration}><Save size={18} /> Save Template Defaults</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

