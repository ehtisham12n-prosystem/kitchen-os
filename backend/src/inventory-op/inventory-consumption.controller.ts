import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { requireBranchId, requireClientId } from '../auth/request-context.util';
import { InventoryOpService } from './inventory-op.service';

@Controller('v1/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryConsumptionController {
  constructor(private readonly inventoryOpService: InventoryOpService) {}

  @Post('consume')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  consume(@RequestUser() user: JwtPayload, @Body() body: any) {
    const branchId = requireBranchId(user, body.branch_id);
    return this.inventoryOpService.consumeStock(requireClientId(user), branchId, body, user);
  }

  @Post('waste')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  waste(@RequestUser() user: JwtPayload, @Body() body: any) {
    const branchId = requireBranchId(user, body.branch_id);
    return this.inventoryOpService.postWaste(requireClientId(user), branchId, body, user);
  }

  @Get('consumption')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  consumption(@RequestUser() user: JwtPayload, @Query() query: any) {
    const branchId = requireBranchId(user, query.branch_id);
    return this.inventoryOpService.listConsumption(requireClientId(user), branchId, query);
  }

  @Get('ledger')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  ledger(@RequestUser() user: JwtPayload, @Query() query: any) {
    const branchId = requireBranchId(user, query.branch_id);
    return this.inventoryOpService.getStockLedger(requireClientId(user), branchId, query);
  }

  @Get('variance')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  variance(@RequestUser() user: JwtPayload, @Query() query: any) {
    const branchId = requireBranchId(user, query.branch_id);
    return this.inventoryOpService.getVarianceReport(requireClientId(user), branchId);
  }
}
