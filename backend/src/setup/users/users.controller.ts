import { Controller, Get, Post, Delete, Body, Param, UseGuards, Put } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { getAccessibleBranchIds, requireClientId } from '../../auth/request-context.util';
import { UserManagementsService } from './users.service';
import { AssignBranchesDto } from './dto/assign-branches.dto';
import { CreateUserDto, UpdateMyProfileDto, UpdateMySecurityDto, UpdateUserDto } from './dto/user.dto';

@Controller('v1/setup/users')
@UseGuards(JwtAuthGuard)
export class UserManagementsController {
  constructor(private readonly usersService: UserManagementsService) { }

  @Get('me')
  getMyProfile(@RequestUser() user: JwtPayload) {
    return this.usersService.findMyProfile(
      requireClientId(user),
      Number(user.sub),
      getAccessibleBranchIds(user),
    );
  }

  @Put('me')
  updateMyProfile(@RequestUser() user: JwtPayload, @Body() dto: UpdateMyProfileDto) {
    return this.usersService.updateMyProfile(
      requireClientId(user),
      Number(user.sub),
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Put('me/security')
  updateMySecurity(@RequestUser() user: JwtPayload, @Body() dto: UpdateMySecurityDto) {
    return this.usersService.updateMySecurity(
      requireClientId(user),
      Number(user.sub),
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
  create(@RequestUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(requireClientId(user), dto, getAccessibleBranchIds(user));
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ, APP_PERMISSIONS.POS.DAY_MANAGE)
  findAll(@RequestUser() user: JwtPayload) {
    return this.usersService.findAll(requireClientId(user), getAccessibleBranchIds(user));
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.findOne(requireClientId(user), +id, getAccessibleBranchIds(user));
  }

  @Get(':id/access')
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  inspectAccess(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.inspectAccess(requireClientId(user), +id, getAccessibleBranchIds(user));
  }

  @Put(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
  update(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(requireClientId(user), +id, dto, getAccessibleBranchIds(user));
  }

  @Put(':id/branches')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
  assignBranches(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AssignBranchesDto) {
    return this.usersService.assignBranches(
      requireClientId(user),
      +id,
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/duplicate-from/:sourceId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
  duplicate(@RequestUser() user: JwtPayload, @Param('id') id: string, @Param('sourceId') sourceId: string) {
    return this.usersService.duplicate(
      requireClientId(user),
      +sourceId,
      +id,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id') // Legacy support for POST updates
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
  updatePost(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(requireClientId(user), +id, dto, getAccessibleBranchIds(user));
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
  remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.remove(requireClientId(user), +id, getAccessibleBranchIds(user));
  }
}
