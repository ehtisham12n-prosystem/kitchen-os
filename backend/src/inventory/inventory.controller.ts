import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  getAccessibleBranchIds,
  requireBranchId,
  requireClientId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryClassDto,
  CreateInventoryItemDto,
  CreateInventorySubTypeDto,
  CreateInventoryTypeDto,
  CreateItemRequestDto,
  ProcessItemRequestDto,
  UpdateBranchItemToggleDto,
  UpdateBranchStockLevelsDto,
  UpdateInventoryClassDto,
  UpdateInventoryItemDto,
  UpdateInventorySubTypeDto,
  UpdateInventoryTypeDto,
} from './dto/inventory-write.dto';

@Controller('v1/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('classes')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createClass(@RequestUser() user: JwtPayload, @Body() body: CreateInventoryClassDto) {
    return this.inventoryService.createClass(requireClientId(user), body);
  }

  @Post('classes/:classId/types')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createType(
    @RequestUser() user: JwtPayload,
    @Param('classId') classId: number,
    @Body() body: CreateInventoryTypeDto,
  ) {
    return this.inventoryService.createType(requireClientId(user), classId, body);
  }

  @Post('types/:typeId/subtypes')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createSubType(
    @RequestUser() user: JwtPayload,
    @Param('typeId') typeId: number,
    @Body() body: CreateInventorySubTypeDto,
  ) {
    return this.inventoryService.createSubType(requireClientId(user), typeId, body);
  }

  @Post('subtypes/:subTypeId/items')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createItem(
    @RequestUser() user: JwtPayload,
    @Param('subTypeId') subTypeId: number,
    @Body() body: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createItem(requireClientId(user), subTypeId, body);
  }

  @Post('classes/:id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async updateClass(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: UpdateInventoryClassDto,
  ) {
    return this.inventoryService.updateClass(requireClientId(user), id, body);
  }

  @Post('classes/:id/delete')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async deleteClass(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.inventoryService.deleteClass(requireClientId(user), id);
  }

  @Post('types/:id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async updateType(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: UpdateInventoryTypeDto,
  ) {
    return this.inventoryService.updateType(requireClientId(user), id, body);
  }

  @Post('types/:id/delete')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async deleteType(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.inventoryService.deleteType(requireClientId(user), id);
  }

  @Post('subtypes/:id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async updateSubType(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: UpdateInventorySubTypeDto,
  ) {
    return this.inventoryService.updateSubType(requireClientId(user), id, body);
  }

  @Post('subtypes/:id/delete')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async deleteSubType(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.inventoryService.deleteSubType(requireClientId(user), id);
  }

  @Post('items/:id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async updateItem(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(requireClientId(user), id, body);
  }

  @Post('items/:id/delete')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async deleteItem(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.inventoryService.deleteItem(requireClientId(user), id);
  }

  @Get('hierarchy')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getFullHierarchy(@RequestUser() user: JwtPayload) {
    return this.inventoryService.getFullHierarchy(requireClientId(user));
  }

  @Get('branch-master')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getBranchMasterData(
    @RequestUser() user: JwtPayload,
    @Query('branchId') branchId?: number,
    @Query('search') search?: string,
    @Query('sku') sku?: string,
    @Query('tag') tag?: string,
    @Query('class') className?: string,
    @Query('category') category?: string,
    @Query('subCategory') subCategory?: string,
    @Query() query?: Record<string, string>,
  ) {
    const clientId = requireClientId(user);
    const targetBranchId = requireBranchId(user, branchId);
    return this.inventoryService.getBranchMasterData(clientId, targetBranchId, {
      search,
      sku,
      tag,
      class: className,
      category,
      subCategory,
      page: query?.page ? +query.page : 1,
      limit: query?.limit ? +query.limit : 50,
    });
  }

  @Get('filter-hierarchy')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getFilterHierarchy(@RequestUser() user: JwtPayload) {
    return this.inventoryService.getFilterHierarchy(requireClientId(user));
  }

  @Post('branch-toggle/:itemId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async toggleBranchItem(
    @RequestUser() user: JwtPayload,
    @Param('itemId') itemId: number,
    @Body() body: UpdateBranchItemToggleDto,
    @Query('branchId') branchId?: number,
  ) {
    const clientId = requireClientId(user);
    const targetBranchId = requireBranchId(user, branchId ?? body.branch_id);
    return this.inventoryService.toggleBranchItem(clientId, targetBranchId, itemId, body.enabled);
  }

  @Post('branch-stock/:itemId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async updateBranchStock(
    @RequestUser() user: JwtPayload,
    @Param('itemId') itemId: number,
    @Body() body: UpdateBranchStockLevelsDto,
    @Query('branchId') branchId?: number,
  ) {
    const clientId = requireClientId(user);
    const targetBranchId = requireBranchId(user, branchId ?? body.branch_id);
    return this.inventoryService.updateBranchStockLevels(
      clientId,
      targetBranchId,
      itemId,
      body.min,
      body.max,
    );
  }

  @Post('requests')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createItemRequest(@RequestUser() user: JwtPayload, @Body() body: CreateItemRequestDto) {
    const clientId = requireClientId(user);
    const branchId = requireBranchId(user, body.branch_id);
    return this.inventoryService.createItemRequest(clientId, branchId, body);
  }

  @Get('requests')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getItemRequests(@RequestUser() user: JwtPayload, @Query('status') status?: string) {
    return this.inventoryService.getItemRequests(
      requireClientId(user),
      status,
      getAccessibleBranchIds(user),
    );
  }

  @Post('requests/:id/process')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async processRequest(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: ProcessItemRequestDto,
  ) {
    return this.inventoryService.processItemRequest(
      requireClientId(user),
      id,
      body.status,
      body.subTypeId,
      body.adminComment,
      getAccessibleBranchIds(user),
    );
  }
}
