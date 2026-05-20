import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { RolePermission } from '../../setup/entities/role-permission.entity';
import { UserRole } from '../../setup/entities/user-role.entity';
import { EntitlementsService } from '../../platform/entitlements/entitlements.service';
import { APP_PERMISSIONS, normalizePermissionKey, parsePermissionKey } from '../constants/permissions';

export interface ResolvedPermissions {
    permissions: Set<string>;
    allowedModules: string[];
}

@Injectable()
export class PermissionResolverService {
    constructor(
        @InjectRepository(UserRole)
        private readonly userRoleRepo: Repository<UserRole>,
        @InjectRepository(RolePermission)
        private readonly rolePermissionRepo: Repository<RolePermission>,
        @InjectRepository(UserManagement)
        private readonly userRepo: Repository<UserManagement>,
        private readonly entitlementsService: EntitlementsService,
    ) { }

    private buildClientAdminPermissions(allowedModules: string[]): string[] {
        if (allowedModules.includes('all')) {
            return ['all'];
        }

        const normalizedAllowedModules = allowedModules.map((moduleName) => moduleName.toLowerCase());
        const permissions = new Set<string>();

        if (normalizedAllowedModules.includes('catalog')) {
            permissions.add(APP_PERMISSIONS.CATALOG.READ);
            permissions.add(APP_PERMISSIONS.CATALOG.WRITE);
            permissions.add(APP_PERMISSIONS.CATALOG.RECIPE_READ);
            permissions.add(APP_PERMISSIONS.CATALOG.RECIPE_WRITE);
        }

        if (normalizedAllowedModules.some((moduleName) => ['auth', 'setup', 'branch'].includes(moduleName))) {
            permissions.add(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES);
            permissions.add(APP_PERMISSIONS.ADMIN.SETUP_COUNTERS);
            permissions.add(APP_PERMISSIONS.ADMIN.SETUP_MASTER);
            permissions.add(APP_PERMISSIONS.ADMIN.SECURITY_USERS);
            permissions.add(APP_PERMISSIONS.ADMIN.SECURITY_ROLES);
            permissions.add(APP_PERMISSIONS.ADMIN.SECURITY_ACCESS);
            permissions.add(APP_PERMISSIONS.HR.STAFF_READ);
            permissions.add(APP_PERMISSIONS.HR.STAFF_WRITE);
        }

        if (normalizedAllowedModules.includes('pos')) {
            permissions.add(APP_PERMISSIONS.POS.ORDER_CREATE);
            permissions.add(APP_PERMISSIONS.POS.ORDER_READ);
            permissions.add(APP_PERMISSIONS.POS.ORDER_TAKER);
            permissions.add(APP_PERMISSIONS.POS.ORDER_CANCEL);
            permissions.add(APP_PERMISSIONS.POS.ORDER_RETURN);
            permissions.add(APP_PERMISSIONS.POS.SHIFT_MANAGE);
            permissions.add(APP_PERMISSIONS.POS.DAY_MANAGE);
            permissions.add(APP_PERMISSIONS.POS.TILL_MANAGE);
            permissions.add(APP_PERMISSIONS.POS.CASHIER_CONSOLE);
            permissions.add(APP_PERMISSIONS.POS.CREDIT_SETTLE);
            permissions.add(APP_PERMISSIONS.POS.KDS_READ);
            permissions.add(APP_PERMISSIONS.POS.REPORTS);
            permissions.add(APP_PERMISSIONS.POS.USER_HISTORY_VIEW);
            permissions.add(APP_PERMISSIONS.POS.USER_HISTORY_TRANSACTIONS);
            permissions.add(APP_PERMISSIONS.POS.USER_HISTORY_AUDIT);
            permissions.add(APP_PERMISSIONS.POS.USER_HISTORY_EXPORT);
        }

        if (normalizedAllowedModules.includes('inventory')) {
            permissions.add(APP_PERMISSIONS.INVENTORY.READ);
            permissions.add(APP_PERMISSIONS.INVENTORY.SETUP);
            permissions.add(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST);
            permissions.add(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE);
            permissions.add(APP_PERMISSIONS.INVENTORY.STOCK_TRANSFER);
            permissions.add(APP_PERMISSIONS.INVENTORY.WASTAGE);
            permissions.add(APP_PERMISSIONS.INVENTORY.ASSETS);
            permissions.add(APP_PERMISSIONS.INVENTORY.LEDGER);
        }

        if (normalizedAllowedModules.includes('procurement')) {
            permissions.add(APP_PERMISSIONS.PROCUREMENT.VENDORS);
            permissions.add(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE);
            permissions.add(APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS);
            permissions.add(APP_PERMISSIONS.PROCUREMENT.PURCHASE_ORDERS_MANAGE);
            permissions.add(APP_PERMISSIONS.PROCUREMENT.PAYMENTS);
            permissions.add(APP_PERMISSIONS.PROCUREMENT.PAYMENTS_MANAGE);
        }

        if (normalizedAllowedModules.includes('accounting')) {
            permissions.add(APP_PERMISSIONS.ACCOUNTING.DASHBOARD);
            permissions.add(APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ);
            permissions.add(APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE);
            permissions.add(APP_PERMISSIONS.ACCOUNTING.VOUCHER);
            permissions.add(APP_PERMISSIONS.ACCOUNTING.BANKS);
            permissions.add(APP_PERMISSIONS.ACCOUNTING.REPORTS);
        }

        if (normalizedAllowedModules.includes('crm')) {
            permissions.add(APP_PERMISSIONS.CRM.CUSTOMERS);
            permissions.add(APP_PERMISSIONS.CRM.CUSTOMERS_CREATE);
            permissions.add(APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE);
            permissions.add(APP_PERMISSIONS.CRM.DEALS);
            permissions.add(APP_PERMISSIONS.CRM.DEALS_MANAGE);
            permissions.add(APP_PERMISSIONS.CRM.CATERING);
            permissions.add(APP_PERMISSIONS.CRM.CATERING_MANAGE);
        }

        if (normalizedAllowedModules.includes('analytics')) {
            permissions.add(APP_PERMISSIONS.ADMIN.ANALYTICS);
            permissions.add(APP_PERMISSIONS.POS.REPORTS);
        }

        return Array.from(permissions).map((permission) => normalizePermissionKey(permission));
    }

    private mapModuleToFeature(moduleName: string): string {
        switch (moduleName) {
            case 'branch':
            case 'counter':
            case 'settings':
            case 'user':
            case 'role':
            case 'permission':
            case 'attendance':
            case 'hr':
                return 'auth';
            case 'pos':
            case 'cashier':
            case 'shift':
            case 'day':
            case 'kds':
            case 'ordering':
            case 'user_history':
            case 'customer':
                return 'pos';
            case 'wastage':
            case 'asset':
            case 'ledger':
            case 'inventory_count':
            case 'inventory_location':
                return 'inventory';
            case 'vendor':
            case 'payment':
            case 'procurement':
                return 'procurement';
            case 'journal':
            case 'coa':
            case 'cash':
            case 'voucher':
            case 'bank':
            case 'reconciliation':
            case 'investor':
            case 'loan':
            case 'profit_distribution':
                return 'accounting';
            case 'deal':
            case 'catering':
                return 'crm';
            case 'recipe':
                return 'recipe';
            case 'report':
                return 'analytics';
            default:
                return moduleName;
        }
    }

    private normalizePermissionList(permissionKeys: string[]): string[] {
        return Array.from(
            new Set(
                permissionKeys
                    .map((permission) => normalizePermissionKey(permission))
                    .filter(Boolean),
            ),
        );
    }

    async hasPermission(userId: number, permission: string, clientId: string, branchId?: number): Promise<boolean> {
        const { permissions } = await this.resolve(userId, branchId, clientId);
        const normalizedPermission = normalizePermissionKey(permission);
        return permissions.has('all') || permissions.has(normalizedPermission);
    }

    async resolve(
        userId: number,
        branchId: number | undefined,
        clientId: string,
    ): Promise<ResolvedPermissions> {
        const entitlements = await this.entitlementsService.getEffectiveEntitlements(clientId);
        const allowedModules: string[] = Array.isArray(entitlements.features) ? entitlements.features : [];
        const normalizedAllowedModules = allowedModules.includes('all')
            ? ['all']
            : allowedModules.map((moduleName) => moduleName.toLowerCase());

        const scopedRoleWhere = branchId
            ? [
                { user_id: userId, branch_id: branchId },
                { user_id: userId, branch_id: IsNull() },
            ]
            : [{ user_id: userId, branch_id: IsNull() }];

        const scopedRoles = await this.userRoleRepo.find({
            where: scopedRoleWhere,
            relations: ['role'],
        });

        const uniqueRoles = new Map<number, UserRole>();
        for (const assignment of scopedRoles) {
            if (!uniqueRoles.has(assignment.role_id)) {
                uniqueRoles.set(assignment.role_id, assignment);
            }
        }

        const roleIds = Array.from(uniqueRoles.keys());
        let rolePermissions: string[] = [];

        if (roleIds.length > 0) {
            const explicitRolePermissions = await this.rolePermissionRepo.find({
                where: { role_id: In(roleIds) },
                relations: ['permission'],
            });

            rolePermissions = explicitRolePermissions
                .map((record) => record.permission?.key)
                .filter((value): value is string => Boolean(value));

            if (rolePermissions.length === 0) {
                rolePermissions = Array.from(uniqueRoles.values())
                    .flatMap((assignment) => assignment.role?.permissions ?? []);
                }
        }

        let isClientAdmin = false;
        if (rolePermissions.length === 0) {
            const user = await this.userRepo.findOne({
                where: { id: userId, client_id: clientId },
                relations: ['roleEntity', 'branchRoles', 'branchRoles.roleEntity'],
            });

            isClientAdmin = user?.user_type === 'CLIENT_ADMIN';

            const legacyScopedRoles = (user?.branchRoles ?? []).filter((assignment) =>
                branchId
                    ? Number(assignment.branch_id) === Number(branchId)
                    : assignment.branch_id == null,
            );

            if (legacyScopedRoles.length > 0) {
                rolePermissions = legacyScopedRoles
                    .flatMap((assignment) => assignment.roleEntity?.permissions ?? [])
                    .filter((value): value is string => Boolean(value));
            }

            if (user?.roleEntity?.permissions?.length) {
                rolePermissions = [...rolePermissions, ...user.roleEntity.permissions];
            }
        }

        if (isClientAdmin && rolePermissions.length === 0) {
            rolePermissions = this.buildClientAdminPermissions(allowedModules);
        }

        const normalizedPermissions = this.normalizePermissionList(rolePermissions);
        const filteredPermissions = new Set<string>();

        for (const permission of normalizedPermissions) {
            if (permission === 'all' || normalizedAllowedModules.includes('all')) {
                filteredPermissions.add(permission);
                continue;
            }

            const { module } = parsePermissionKey(permission);
            const featureKey = this.mapModuleToFeature(module);
            if (!featureKey || normalizedAllowedModules.includes(featureKey) || normalizedAllowedModules.includes(module)) {
                filteredPermissions.add(permission);
            }
        }

        return { permissions: filteredPermissions, allowedModules };
    }
}
