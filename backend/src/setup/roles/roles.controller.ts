import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { APP_PERMISSIONS, PERMISSION_GROUPS } from '../../auth/constants/permissions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { requireClientId } from '../../auth/request-context.util';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Controller('v1/setup/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
  ) { }

  /**
   * Console Permission Registry — returns ONLY non-nexus modules.
   * Nexus-specific modules (nexus_clients, nexus_users, etc.) are never exposed here.
   * Subscription-based filtering: pass ?modules=catalog,pos as a future enhancement.
   */
  @Get('permissions')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_ROLES)
  async getPermissionsRegistry() {
    return PERMISSION_GROUPS;
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_ROLES)
  create(@RequestUser() user: JwtPayload, @Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(requireClientId(user), createRoleDto);
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  findAll(@RequestUser() user: JwtPayload) {
    return this.rolesService.findAll(requireClientId(user));
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.rolesService.findOne(requireClientId(user), +id);
  }

  @Put(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_ROLES)
  update(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(requireClientId(user), +id, updateRoleDto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_ROLES)
  remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.rolesService.remove(requireClientId(user), +id);
  }
}
