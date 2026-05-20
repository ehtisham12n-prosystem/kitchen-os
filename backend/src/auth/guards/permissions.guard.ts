import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../setup/entities/Roles.entity';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectRepository(Role)
        private roleRepo: Repository<Role>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const requiredAnyPermissions = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions && !requiredAnyPermissions) {
            return true;
        }

        const { UserManagement } = context.switchToHttp().getRequest();

        // Super Admins bypass everything
        if (UserManagement.is_system || UserManagement.role === 'platform.all') {
            return true;
        }

        const role = await this.roleRepo.findOne({ where: { client_id: UserManagement.client_id, role_name: UserManagement.role } });

        if (!role) {
            throw new ForbiddenException('Role not found');
        }

        const UserManagementPermissions = Array.isArray(role.permissions) ? role.permissions : JSON.parse(role.permissions as any);

        const hasAllPermissions = !requiredPermissions?.length || requiredPermissions.every((permission) =>
            UserManagementPermissions.includes(permission) || UserManagementPermissions.includes('all')
        );
        const hasAnyPermission = !requiredAnyPermissions?.length || requiredAnyPermissions.some((permission) =>
            UserManagementPermissions.includes(permission) || UserManagementPermissions.includes('all')
        );

        if (!hasAllPermissions || !hasAnyPermission) {
            throw new ForbiddenException('Insufficient permissions');
        }

        return true;
    }
}
