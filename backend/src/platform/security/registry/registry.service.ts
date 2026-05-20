import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionModule } from '../../entities/permission-module.entity';
import { PermissionPage } from '../../entities/permission-page.entity';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import { SysGroupsService } from '../sys-groups/sys-groups.service';
// import { TenantGroupsService } from '../../../platform/tenant-groups/tenant-groups.service';
import { Inject, forwardRef } from '@nestjs/common';

@Injectable()
export class RegistryService {
    constructor(
        @InjectRepository(PermissionModule)
        private readonly moduleRepo: Repository<PermissionModule>,
        @InjectRepository(PermissionPage)
        private readonly pageRepo: Repository<PermissionPage>,
        @Inject(forwardRef(() => SysGroupsService))
        private readonly sysGroupsService: SysGroupsService,
        // @Inject(forwardRef(() => TenantGroupsService))
        // private readonly tenantGroupsService: TenantGroupsService,
    ) { }

    private async triggerSync() {
        try {
            await Promise.all([
                this.sysGroupsService.syncFullControlPermissions(),
                // this.tenantGroupsService.syncFullControlPermissions()
            ]);
        } catch (e) {
            console.error('[RegistrySync] Synchronization failed:', e);
        }
    }

    // ─── Modules ─────────────────────────────────────────────────────────────

    async findAllModules() {
        return this.moduleRepo.find({
            relations: ['pages'],
            order: { name: 'ASC' }
        });
    }

    /** Returns only Nexus-internal modules (slug starts with nexus_) */
    async findNexusModules() {
        const all = await this.moduleRepo.find({
            relations: ['pages'],
            order: { name: 'ASC' }
        });
        return all.filter(m => m.slug?.startsWith('nexus_'));
    }

    /**
     * Returns tenant/Console modules only — never exposing nexus_ modules.
     * Further filtered to the client's subscribed modules (allowedModules[]).
     * If allowedModules is empty/null, returns all non-nexus modules (fallback for super-admin).
     */
    async findConsoleModules(allowedModules?: string[]) {
        const all = await this.moduleRepo.find({
            relations: ['pages'],
            order: { name: 'ASC' }
        });

        // Strip Nexus-only modules — these should never bleed into Console
        const consoleModules = all.filter(m => !m.slug?.startsWith('nexus_'));

        // If no subscription filter, return all Console-eligible modules
        if (!allowedModules || allowedModules.length === 0) {
            return consoleModules;
        }

        // Always include admin/security/hr modules regardless of subscription
        const ALWAYS_VISIBLE_PREFIXES = ['admin_', 'hr'];

        return consoleModules.filter(m => {
            if (ALWAYS_VISIBLE_PREFIXES.some(prefix => m.slug?.startsWith(prefix) || m.slug === prefix)) return true;
            return allowedModules.some(allowed => m.slug?.startsWith(allowed) || allowed.startsWith(m.slug || ''));
        });
    }

    async createModule(dto: CreateModuleDto, adminId: string) {
        const existing = await this.moduleRepo.findOne({ where: { slug: dto.slug } });
        if (existing) throw new BadRequestException('Module slug already exists');

        const module = this.moduleRepo.create({
            ...dto,
            created_by: adminId
        });
        const saved = await this.moduleRepo.save(module);
        await this.triggerSync();
        return saved;
    }

    async updateModule(id: string, dto: UpdateModuleDto) {
        await this.moduleRepo.update(id, dto);
        return this.moduleRepo.findOne({ where: { id }, relations: ['pages'] });
    }

    // ─── Pages ───────────────────────────────────────────────────────────────

    async createPage(dto: CreatePageDto, adminId: string) {
        const mod = await this.moduleRepo.findOne({ where: { id: dto.module_id } });
        if (!mod) throw new BadRequestException('Parent module not found');

        const page = this.pageRepo.create({
            ...dto,
            created_by: adminId
        });
        const saved = await this.pageRepo.save(page);
        await this.triggerSync();
        return saved;
    }

    async updatePage(id: string, dto: UpdatePageDto) {
        await this.pageRepo.update(id, dto);
        return this.pageRepo.findOne({ where: { id } });
    }

    async deletePage(id: string) {
        return this.pageRepo.delete(id);
    }

    // ─── Seed Helper ──────────────────────────────────────────────────────────────
    async seedAll() {
        // Cleanup legacy modules
        await this.moduleRepo.delete({ slug: 'pos' });
        await this.moduleRepo.delete({ slug: 'nexus_pos' });

        // ── Nexus-only modules (visible only in Nexus portal) ──────────────────────
        const NEXUS_REGISTRY = [
            {
                id: 'nexus_clients',
                name: 'Client Management',
                iconName: 'Boxes',
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
                iconName: 'Shield',
                description: 'Internal platform administrators and support staff.',
                pages: [
                    { id: 'user_list', name: 'Platform Users', description: 'Manage Nexus portal access.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'user_logs', name: 'Login Audit', description: 'Track platform login attempts.', actions: ['read', 'export'] }
                ]
            },
            {
                id: 'nexus_security',
                name: 'Security & RBAC',
                iconName: 'Key',
                description: 'Define platform roles, groups, and permission registry.',
                pages: [
                    { id: 'role_mgmt', name: 'Role Management', description: 'Define horizontal access roles.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'group_mgmt', name: 'Group Management', description: 'Define vertical functional groups.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'perm_registry', name: 'Permission Registry', description: 'Canonical list of all system rights.', actions: ['read', 'update', 'sync'] }
                ]
            },
            {
                id: 'nexus_finance',
                name: 'Finance & Invoices',
                iconName: 'ShoppingCart',
                description: 'Automated billing and invoice tracking.',
                pages: [
                    { id: 'invoice_list', name: 'Invoices', description: 'Track platform-wide revenue.', actions: ['read', 'create', 'refund', 'export'] }
                ]
            },
            {
                id: 'nexus_infrastructure',
                name: 'Infrastructure & Themes',
                iconName: 'LayoutGrid',
                description: 'Manage design system, themes, and global settings.',
                pages: [
                    { id: 'theme_library', name: 'Theme Library', description: 'Manage global UI presets.', actions: ['read', 'create', 'update', 'publish'] },
                    { id: 'org_settings', name: 'Organization Settings', description: 'Global metadata and API keys.', actions: ['read', 'update'] }
                ]
            },
            {
                id: 'nexus_subscription',
                name: 'Subscription Master',
                iconName: 'Package',
                description: 'Define SaaS plans and billing groups.',
                pages: [
                    { id: 'sub_plans', name: 'Package Groups', description: 'Global plan hierarchy.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'addons', name: 'Add-on Definitions', description: 'Optional features registry.', actions: ['read', 'create', 'update'] }
                ]
            },
            {
                id: 'nexus_menu_standards',
                name: 'Menu Standards',
                iconName: 'Utensils',
                description: 'Global master data for menu architecture and cross-client catalog standards.',
                pages: [
                    { id: 'menu_cat', name: 'Global Categories', description: 'Master catalog taxonomy used across client blueprints.', actions: ['read', 'update'] },
                    { id: 'cuisine_types', name: 'Cuisine Types', description: 'Global cuisine and concept classification standards.', actions: ['read', 'update'] }
                ]
            },
            {
                id: 'nexus_ops_logs',
                name: 'Operations & Audit',
                iconName: 'Activity',
                description: 'Platform broadcast systems and system-wide logs.',
                pages: [
                    { id: 'broadcasts', name: 'Global Announcements', description: 'Broadcast events to all clients.', actions: ['read', 'create', 'delete'] },
                    { id: 'audit_logs', name: 'System Audit', description: 'Deep security forensic logs.', actions: ['read', 'export'] },
                    { id: 'radar', name: 'Usage Radar', description: 'Real-time performance metrics.', actions: ['read'] }
                ]
            }
        ];

        for (const modData of NEXUS_REGISTRY) {
            let savedMod = await this.moduleRepo.findOne({ where: { slug: modData.id } });
            if (!savedMod) {
                const mod = this.moduleRepo.create({ slug: modData.id, name: modData.name, description: modData.description, icon: modData.iconName, created_by: 'system' });
                savedMod = await this.moduleRepo.save(mod);
            }
            for (const pageData of modData.pages) {
                const existingPage = await this.pageRepo.findOne({ where: { slug: pageData.id, module_id: savedMod.id } });
                if (!existingPage) {
                    const page = this.pageRepo.create({ module_id: savedMod.id, slug: pageData.id, name: pageData.name, description: pageData.description, actions: pageData.actions, created_by: 'system' });
                    await this.pageRepo.save(page);
                }
            }
        }

        // ── Console (Tenant) modules ───────────────────────────────────────────────
        const INITIAL_REGISTRY = [
            {
                id: 'admin_security',
                name: 'Security & Access Control',
                iconName: 'ShieldCheck',
                description: 'Manage users, roles, and granular permission sets.',
                pages: [
                    { id: 'users', name: 'User Directory', description: 'Manage employee system accounts.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'roles', name: 'Role Management', description: 'Define functional access roles.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'access', name: 'Access Control', description: 'Assign roles to users and branches.', actions: ['read', 'update'] }
                ]
            },
            {
                id: 'admin_setup',
                name: 'Organization Configuration',
                iconName: 'Building2',
                description: 'Core organizational settings and branch management.',
                pages: [
                    { id: 'branches', name: 'Branch Management', description: 'Manage physical restaurant locations.', actions: ['read', 'create', 'update'] },
                    { id: 'counters', name: 'Sale Counters', description: 'Configure POS terminals and tills.', actions: ['read', 'create', 'update'] },
                    { id: 'taxes', name: 'Tax Configuration', description: 'Define VAT, GST, and Service Charges.', actions: ['read', 'update'] },
                    { id: 'payments', name: 'Payment Methods', description: 'Manage accepted payment types.', actions: ['read', 'update'] }
                ]
            },
            {
                id: 'catalog',
                name: 'Product Catalog & Menu',
                iconName: 'Database',
                description: 'Master data for products, recipes, and menu architecture.',
                pages: [
                    { id: 'items', name: 'Product Master', description: 'Define sellable items and pricing.', actions: ['read', 'create', 'update', 'delete'] },
                    { id: 'categories', name: 'Menu Categories', description: 'Organize items into logical groups.', actions: ['read', 'update'] },
                    { id: 'architecture', name: 'Menu Architecture', description: 'Manage global menu hierarchies.', actions: ['read', 'update'] },
                    { id: 'recipes', name: 'Recipes & BOM', description: 'Define ingredient breakdowns for products.', actions: ['read', 'create', 'update'] }
                ]
            },
            {
                id: 'inventory',
                name: 'Stock & Inventory',
                iconName: 'Package',
                description: 'Real-time stock tracking and warehouse operations.',
                pages: [
                    { id: 'stock', name: 'Stock Balance', description: 'View current inventory levels.', actions: ['read', 'adjust', 'transfer'] },
                    { id: 'op', name: 'Inventory Operations', description: 'Track GRNs, issuances, and disposals.', actions: ['read', 'receive', 'issue'] },
                    { id: 'assets', name: 'Asset Register', description: 'Track non-consumable equipment.', actions: ['read', 'manage'] }
                ]
            },
            {
                id: 'procurement',
                name: 'Procurement & Vendors',
                iconName: 'Truck',
                description: 'Supplier management and purchase order lifecycle.',
                pages: [
                    { id: 'vendors', name: 'Vendor Directory', description: 'Manage supplier contact and terms.', actions: ['read', 'create', 'update'] },
                    { id: 'po', name: 'Purchase Orders', description: 'Create and track stock orders.', actions: ['read', 'create', 'approve'] },
                    { id: 'payments', name: 'Vendor Payments', description: 'Track payouts and balances.', actions: ['read', 'create'] }
                ]
            },
            {
                id: 'accounting',
                name: 'Financial Accounting',
                iconName: 'Calculator',
                description: 'General ledger, charts of accounts, and financial reports.',
                pages: [
                    { id: 'coa', name: 'Chart of Accounts', description: 'Master list of financial accounts.', actions: ['read', 'manage'] },
                    { id: 'journal', name: 'Journal Entries', description: 'Record manual financial transactions.', actions: ['read', 'create'] },
                    { id: 'ledger', name: 'General Ledger', description: 'detailed transaction history per account.', actions: ['read'] },
                    { id: 'reports', name: 'Financial Reports', description: 'P&L, Balance Sheet, and Cash Flow.', actions: ['read', 'export'] }
                ]
            },
            {
                id: 'hr',
                name: 'Human Resources',
                iconName: 'Users',
                description: 'Employee profiles, attendance, and designations.',
                pages: [
                    { id: 'staff', name: 'Staff Records', description: 'Maintain employee personal files.', actions: ['read', 'update'] },
                    { id: 'attendance', name: 'Attendance Logs', description: 'Track clock-in/out and manual overrides.', actions: ['read', 'mark'] }
                ]
            },
            {
                id: 'pos',
                name: 'Point of Sale (Operational)',
                iconName: 'Smartphone',
                description: 'Front-of-house sales, cashier control, counter sessions, and business-day operations.',
                pages: [
                    { id: 'order', name: 'Order Operations', description: 'Create, review, return, cancel, and reprint sales receipts.', actions: ['create', 'read', 'cancel', 'return', 'print'] },
                    { id: 'cashier', name: 'Cashier Console', description: 'Review cashier orders, settle credits, and print payment receipts.', actions: ['read', 'manage', 'settle', 'print'] },
                    { id: 'day', name: 'Business Day & Counters', description: 'Run daily opening, counter sessions, X/Z reports, and business-day closing.', actions: ['manage', 'report'] }
                ]
            }
        ];

        for (const modData of INITIAL_REGISTRY) {
            let savedMod = await this.moduleRepo.findOne({ where: { slug: modData.id } });
            if (!savedMod) {
                const mod = this.moduleRepo.create({
                    slug: modData.id,
                    name: modData.name,
                    description: modData.description,
                    icon: modData.iconName,
                    created_by: 'system'
                });
                savedMod = await this.moduleRepo.save(mod);
            } else {
                savedMod.name = modData.name;
                savedMod.description = modData.description;
                savedMod.icon = modData.iconName;
                await this.moduleRepo.save(savedMod);
            }

            for (const pageData of modData.pages) {
                let existingPage = await this.pageRepo.findOne({ where: { slug: pageData.id, module_id: savedMod.id } });
                if (!existingPage) {
                    const page = this.pageRepo.create({
                        module_id: savedMod.id,
                        slug: pageData.id,
                        name: pageData.name,
                        description: pageData.description,
                        actions: pageData.actions,
                        created_by: 'system'
                    });
                    await this.pageRepo.save(page);
                } else {
                    existingPage.name = pageData.name;
                    existingPage.description = pageData.description;
                    existingPage.actions = pageData.actions;
                    await this.pageRepo.save(existingPage);
                }
            }
        }

        await this.triggerSync();
    }
}
