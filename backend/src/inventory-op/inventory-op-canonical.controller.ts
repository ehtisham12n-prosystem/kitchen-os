import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  getAccessibleBranchIds,
  requireActiveBranchMatch,
  requireBranchId,
  requireClientId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  AdjustStockDto,
  CaptureGrnBillDto,
  CreateGrnReturnDto,
  IssueToKitchenDto,
  ListGoodsReceiptsQueryDto,
  ListStockLedgerQueryDto,
  ReceiveStockDto,
} from './dto/inventory-op.dto';
import { InventoryOpService } from './inventory-op.service';

@Controller('v1/inventory-op')
@UseGuards(JwtAuthGuard)
export class InventoryOpCanonicalController {
  constructor(private readonly inventoryOpService: InventoryOpService) {}

  @Get('branch/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getBranchStock(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    return this.inventoryOpService.getBranchStock(
      requireClientId(user),
      requireBranchId(user, branchId),
    );
  }

  @Get('ledger/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getStockLedger(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query() query: ListStockLedgerQueryDto,
  ) {
    const clientId = requireClientId(user);
    const scopedBranchId = requireBranchId(user, branchId);
    if (query.paginate) {
      return this.inventoryOpService.getStockLedgerPage(
        clientId,
        scopedBranchId,
        query,
      );
    }

    return this.inventoryOpService.getStockLedger(clientId, scopedBranchId, query);
  }

  @Get('dashboard/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getInventoryDashboard(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    return this.inventoryOpService.getInventoryDashboard(
      requireClientId(user),
      requireBranchId(user, branchId),
    );
  }

  @Get('grns')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async listGrns(
    @RequestUser() user: JwtPayload,
    @Query() query: ListGoodsReceiptsQueryDto,
  ) {
    const clientId = requireClientId(user);
    const accessibleBranchIds = getAccessibleBranchIds(user);
    if (query.paginate) {
      return this.inventoryOpService.listGoodsReceiptsPage(
        clientId,
        accessibleBranchIds,
        query,
      );
    }

    return this.inventoryOpService.listGoodsReceipts(clientId, accessibleBranchIds);
  }

  @Get('grns/:id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getGrn(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
  ) {
    return this.inventoryOpService.getGoodsReceipt(
      requireClientId(user),
      id,
      getAccessibleBranchIds(user),
    );
  }

  @Post('grns/:id/bill')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
  async captureGrnBill(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: CaptureGrnBillDto,
  ) {
    return this.inventoryOpService.captureVendorBill(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post('grns/:id/returns')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createGrnReturn(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: CreateGrnReturnDto,
  ) {
    return this.inventoryOpService.createPurchaseReturn(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post('grns')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
  async createGrn(
    @RequestUser() user: JwtPayload,
    @Body() body: ReceiveStockDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireActiveBranchMatch(user, body.branch_id);
    return this.inventoryOpService.receiveStock(
      clientId,
      branchId,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post('receive/:branchId/:poId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
  async receivePurchaseOrder(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Param('poId') poId: number,
  ) {
    const clientId = requireClientId(user);
    const scopedBranchId = requireActiveBranchMatch(user, branchId);
    return this.inventoryOpService.receivePurchaseOrder(
      clientId,
      scopedBranchId,
      poId,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post('adjust/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async adjustStock(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: AdjustStockDto,
  ) {
    const clientId = requireClientId(user);
    const scopedBranchId = requireActiveBranchMatch(user, branchId);
    return this.inventoryOpService.adjustStock(
      clientId,
      scopedBranchId,
      { ...body, branch_id: scopedBranchId },
      user,
    );
  }

  @Post('issue/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async issueToKitchen(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Body() body: IssueToKitchenDto,
  ) {
    const clientId = requireClientId(user);
    const scopedBranchId = requireActiveBranchMatch(user, branchId);
    return this.inventoryOpService.issueToKitchen(
      clientId,
      scopedBranchId,
      { ...body, branch_id: scopedBranchId },
      user,
    );
  }
}
