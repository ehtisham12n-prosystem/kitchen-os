import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SYSTEM_PERMISSION_REGISTRY, normalizePermissionKey } from '../../auth/constants/permissions';
import { DEFAULT_ROLE_TEMPLATES } from '../../auth/constants/role-templates';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/Roles.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import {
  type RoleContextScope,
  type UserApprovalAuthority,
} from '../users/user-governance.constants';

type RoleTemplate = Partial<Role> & {
  role_name: string;
  context_scope: RoleContextScope;
  approval_authority: UserApprovalAuthority | null;
};

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepo: Repository<RolePermission>,
  ) { }

  private getDefaultRoleTemplates(clientId: string): RoleTemplate[] {
    return DEFAULT_ROLE_TEMPLATES.map((template) => ({
      client_id: clientId,
      role_name: template.name,
      permissions: template.permissions,
      description: template.description,
      is_active: true,
      is_system_role: true,
      context_scope: template.contextScope,
      approval_authority: template.approvalAuthority,
    }));
  }

  private async ensurePermissionRegistry(): Promise<Map<string, Permission>> {
    const normalizedKeys = SYSTEM_PERMISSION_REGISTRY.map((permission) => normalizePermissionKey(permission.key));
    const existing = await this.permissionRepo.find({ where: { key: In(normalizedKeys) } });
    const existingByKey = new Map(existing.map((permission) => [normalizePermissionKey(permission.key), permission]));

    const missing = SYSTEM_PERMISSION_REGISTRY
      .filter((permission) => !existingByKey.has(normalizePermissionKey(permission.key)))
      .map((permission) => this.permissionRepo.create({
        key: normalizePermissionKey(permission.key),
        module: permission.module,
        action: permission.action,
        scope: permission.scope,
      }));

    if (missing.length > 0) {
      const created = await this.permissionRepo.save(missing);
      for (const permission of created) {
        existingByKey.set(normalizePermissionKey(permission.key), permission);
      }
    }

    return existingByKey;
  }

  private async syncRolePermissionLinks(role: Role, permissionMap: Map<string, Permission>): Promise<void> {
    const normalizedPermissions = Array.from(new Set((role.permissions ?? []).map((permission) => normalizePermissionKey(permission))));
    const validPermissions = normalizedPermissions
      .filter((permission) => permission === 'all' || permissionMap.has(permission));

    const existingLinks = await this.rolePermissionRepo.find({ where: { role_id: role.id } });
    if (existingLinks.length > 0) {
      await this.rolePermissionRepo.remove(existingLinks);
    }

    const links = validPermissions
      .filter((permission) => permission !== 'all')
      .map((permission) => this.rolePermissionRepo.create({
        role_id: role.id,
        permission_id: permissionMap.get(permission)!.id,
      }));

    if (links.length > 0) {
      await this.rolePermissionRepo.save(links);
    }
  }

  private normalizeRole(role: Role): Role {
    role.permissions = Array.from(new Set((role.permissions ?? []).map((permission) => normalizePermissionKey(permission))));
    role.name = role.name || role.role_name;
    return role;
  }

  async ensureDefaultRoles(clientId: string): Promise<void> {
    const permissionMap = await this.ensurePermissionRegistry();
    const existingRoles = await this.roleRepo.find({
      where: { client_id: clientId },
      select: ['id', 'role_name', 'context_scope', 'approval_authority', 'is_system_role', 'permissions'],
    });
    const templateMap = new Map(
      this.getDefaultRoleTemplates(clientId).map((template) => [template.role_name, template]),
    );
    const existingByName = new Map(existingRoles.map((role) => [role.role_name, role]));
    const missingTemplates = [...templateMap.values()]
      .filter((template) => !existingByName.has(String(template.role_name)));

    if (missingTemplates.length > 0) {
      await this.roleRepo.save(
        missingTemplates.map((template) => this.roleRepo.create(template)),
      );
    }

    // Also update existing system roles if their permissions are out of sync with new structure
    const updates = existingRoles.map(role => {
        const template = templateMap.get(role.role_name);
        if (template && role.is_system_role) {
            return {
                ...role,
                name: role.name || role.role_name,
                permissions: template.permissions,
                description: template.description || role.description,
                context_scope: template.context_scope,
                approval_authority: template.approval_authority,
            };
        }
        return null;
    }).filter(r => r !== null);

    if (updates.length > 0) {
        await this.roleRepo.save(updates);
    }

    const syncedRoles = await this.roleRepo.find({ where: { client_id: clientId, is_active: true } });
    for (const role of syncedRoles) {
      await this.syncRolePermissionLinks(role, permissionMap);
    }
  }

  async create(clientId: string, dto: CreateRoleDto): Promise<Role> {
    const roleData = {
      client_id: clientId,
      permissions: dto.permissions ?? [],
      context_scope: dto.context_scope ?? 'hybrid',
      approval_authority: dto.approval_authority ?? 'none',
      is_active: dto.is_active ?? true,
      ...dto,
    };
    const role = this.roleRepo.create({
      ...roleData,
      name: dto.role_name ?? null,
      permissions: (dto.permissions ?? []).map((permission) => normalizePermissionKey(permission)),
    } as object);
    const savedRole = await this.roleRepo.save(role);
    const permissionMap = await this.ensurePermissionRegistry();
    await this.syncRolePermissionLinks(savedRole, permissionMap);
    return savedRole;
  }

  async findAll(clientId: string): Promise<Role[]> {
    await this.ensureDefaultRoles(clientId);
    const roles = await this.roleRepo.find({ where: { client_id: clientId, is_active: true } });
    return roles.map((role) => this.normalizeRole(role));
  }

  async findOne(clientId: string, id: number): Promise<Role | null> {
    await this.ensureDefaultRoles(clientId);
    const role = await this.roleRepo.findOne({ where: { client_id: clientId, id, is_active: true } });
    return role ? this.normalizeRole(role) : null;
  }

  async update(clientId: string, id: number, dto: UpdateRoleDto): Promise<Role | null> {
    const role = await this.findOne(clientId, id);
    if (!role) return null;
    Object.assign(role, dto);
    role.permissions = (role.permissions ?? []).map((permission) => normalizePermissionKey(permission));
    if (dto.context_scope === undefined && !role.context_scope) {
      role.context_scope = 'hybrid';
    }
    if (dto.approval_authority === undefined && role.approval_authority === undefined) {
      role.approval_authority = 'none';
    }
    const savedRole = await this.roleRepo.save(role);
    const permissionMap = await this.ensurePermissionRegistry();
    await this.syncRolePermissionLinks(savedRole, permissionMap);
    return savedRole;
  }

  async remove(clientId: string, id: number): Promise<boolean> {
    const role = await this.findOne(clientId, id);
    if (!role) return false;
    if (role.is_system_role) {
      throw new BadRequestException('System roles cannot be deactivated.');
    }
    role.is_active = false;
    await this.roleRepo.save(role);
    return true;
  }
}
