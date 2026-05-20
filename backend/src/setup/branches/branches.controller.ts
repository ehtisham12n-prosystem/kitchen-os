import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Patch,
  UseGuards,
  ParseArrayPipe,
  Query,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { DiningLayoutService } from '../layout/dining-layout.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import {
  getAccessibleBranchIds,
  requireBranchId,
  requireClientId,
} from '../../auth/request-context.util';
import {
  CreateBranchChargeDto,
  CreateBranchDto,
  CreateBranchLocationDto,
  BranchInventoryControlSettingsDto,
  CreateFloorDto,
  CreateTableDto,
  UpdateBranchChargeDto,
  UpdateBranchDto,
  UpdateBranchLocationDto,
  UpdateBranchStatusDto,
  UpdateFloorDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/branch.dto';

@Controller('v1/setup/branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly layoutService: DiningLayoutService
  ) { }

  @Get(':id/layout')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  getLayout(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.layoutService.getFullBranchLayout(requireClientId(user), requireBranchId(user, +id));
  }

  @Post(':id/floors')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  createFloor(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CreateFloorDto) {
    return this.layoutService.createFloor(requireClientId(user), requireBranchId(user, +id), dto);
  }

  @Put('floors/:floorId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  updateFloor(@RequestUser() user: JwtPayload, @Param('floorId') floorId: string, @Body() dto: UpdateFloorDto) {
    return this.layoutService.updateFloor(
      requireClientId(user),
      +floorId,
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Delete('floors/:floorId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  removeFloor(@RequestUser() user: JwtPayload, @Param('floorId') floorId: string) {
    return this.layoutService.removeFloor(
      requireClientId(user),
      +floorId,
      getAccessibleBranchIds(user),
    );
  }

  @Post('floors/:floorId/tables')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  createTable(@RequestUser() user: JwtPayload, @Param('floorId') floorId: string, @Body() dto: CreateTableDto) {
    return this.layoutService.createTable(
      requireClientId(user),
      +floorId,
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Put('tables/:tableId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  updateTable(
    @RequestUser() user: JwtPayload,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.layoutService.updateTable(
      requireClientId(user),
      +tableId,
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Put('tables/:tableId/status')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  updateTableStatus(
    @RequestUser() user: JwtPayload,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.layoutService.updateTableStatus(
      requireClientId(user),
      +tableId,
      dto.status,
      getAccessibleBranchIds(user),
    );
  }

  @Delete('tables/:tableId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  removeTable(@RequestUser() user: JwtPayload, @Param('tableId') tableId: string) {
    return this.layoutService.removeTable(
      requireClientId(user),
      +tableId,
      getAccessibleBranchIds(user),
    );
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  create(@RequestUser() user: JwtPayload, @Body() createBranchDto: CreateBranchDto) {
    const clientId = requireClientId(user);
    return this.branchesService.create(
      clientId,
      createBranchDto,
      String((user as any).userId || user.sub),
      user,
    );
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  findAll(
    @RequestUser() user: JwtPayload,
    @Query('name') name?: string,
    @Query('status') status?: string
  ) {
    // If the user is a Client Admin or System user, bypass session-based branch filtering
    const isGlobalAdmin = user.organization_user_type === 'CLIENT_ADMIN' || user.is_system === true;
    const accessibleBranchIds = isGlobalAdmin ? undefined : getAccessibleBranchIds(user);

    return this.branchesService.findAll(
      requireClientId(user),
      { name, status },
      accessibleBranchIds,
    );
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.branchesService.findOne(requireClientId(user), requireBranchId(user, +id));
  }

  @Get(':id/inventory-control-settings')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS)
  getInventoryControlSettings(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.branchesService.getInventoryControlSettings(
      requireClientId(user),
      requireBranchId(user, +id),
    );
  }

  @Put(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  update(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    const clientId = requireClientId(user);
    return this.branchesService.update(
      clientId,
      requireBranchId(user, +id),
      updateBranchDto,
      String((user as any).userId || user.sub),
      user,
    );
  }

  @Put(':id/inventory-control-settings')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS)
  updateInventoryControlSettings(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: BranchInventoryControlSettingsDto,
  ) {
    const clientId = requireClientId(user);
    return this.branchesService.updateInventoryControlSettings(
      clientId,
      requireBranchId(user, +id),
      dto,
      String((user as any).userId || user.sub),
      user,
    );
  }

  @Patch(':id/status')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  updateStatus(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBranchStatusDto,
  ) {
    const clientId = requireClientId(user);
    return this.branchesService.setStatus(
      clientId,
      requireBranchId(user, +id),
      dto.status,
      String((user as any).userId || user.sub),
      user,
    );
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  deactivate(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    const clientId = requireClientId(user);
    return this.branchesService.setStatus(
      clientId,
      requireBranchId(user, +id),
      'inactive',
      String((user as any).userId || user.sub),
      user,
    );
  }

  @Post(':id/activate')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  activate(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    const clientId = requireClientId(user);
    return this.branchesService.setStatus(
      clientId,
      requireBranchId(user, +id),
      'active',
      String((user as any).userId || user.sub),
      user,
    );
  }

  @Get(':id/modules')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async getModules(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    const branch = await this.branchesService.findOne(requireClientId(user), requireBranchId(user, +id));
    return branch.modules_enabled || [];
  }

  @Get(':id/locations')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE)
  async getLocations(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.branchesService.findLocations(requireClientId(user), requireBranchId(user, +id));
  }

  @Post(':id/locations')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE)
  async createLocation(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateBranchLocationDto,
  ) {
    return this.branchesService.createLocation(requireClientId(user), requireBranchId(user, +id), dto);
  }

  @Put('locations/:locationId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE)
  async updateLocation(
    @RequestUser() user: JwtPayload,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateBranchLocationDto,
  ) {
    return this.branchesService.updateLocation(
      requireClientId(user),
      +locationId,
      dto,
      getAccessibleBranchIds(user),
    );
  }

  @Delete('locations/:locationId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE)
  async deleteLocation(@RequestUser() user: JwtPayload, @Param('locationId') locationId: string) {
    await this.branchesService.removeLocation(
      requireClientId(user),
      +locationId,
      getAccessibleBranchIds(user),
    );
    return { success: true };
  }

  @Post(':id/modules')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  assignModules(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseArrayPipe({ items: String })) modules: string[],
  ) {
    const clientId = requireClientId(user);
    return this.branchesService.assignModules(
      clientId,
      requireBranchId(user, +id),
      modules,
      String((user as any).userId || user.sub),
      user,
    );
  }

  // --- BRANCH CHARGES ---

  @Get(':id/charges')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async findCharges(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.branchesService.findCharges(requireClientId(user), requireBranchId(user, +id));
  }

  @Post(':id/charges')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async createCharge(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateBranchChargeDto,
  ) {
    return this.branchesService.createCharge(requireClientId(user), requireBranchId(user, +id), dto);
  }

  @Put(':id/charges/:chargeId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async updateCharge(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @Body() dto: UpdateBranchChargeDto,
  ) {
    return this.branchesService.updateCharge(
      requireClientId(user),
      requireBranchId(user, +id),
      +chargeId,
      dto,
    );
  }

  @Delete(':id/charges/:chargeId')
  @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
  async removeCharge(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('chargeId') chargeId: string
  ) {
    return this.branchesService.removeCharge(
      requireClientId(user),
      requireBranchId(user, +id),
      +chargeId,
    );
  }
}
