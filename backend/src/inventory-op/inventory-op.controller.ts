import {
    Body,
    Controller,
    Get,
    Header,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
    getAccessibleBranchIds,
    requireActiveBranchMatch,
    requireClientId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { AdjustStockDto, CaptureGrnBillDto, IssueToKitchenDto, ReceiveStockDto } from './dto/inventory-op.dto';
import { InventoryOpService } from './inventory-op.service';

@Controller('v1/inventory/ops')
@UseGuards(JwtAuthGuard)
export class InventoryOpController {
    constructor(private readonly inventoryOpService: InventoryOpService) {}

    @Post('receive')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory-op/grns')
    async receiveStock(
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

    @Post('adjust')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory-op/adjust/:branchId')
  async adjustStock(
    @RequestUser() user: JwtPayload,
    @Body() body: AdjustStockDto,
  ) {
        const clientId = requireClientId(user);
    const branchId = requireActiveBranchMatch(user, body.branch_id);
    return this.inventoryOpService.adjustStock(clientId, branchId, body, user);
  }

  @Post('issue')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  @Header('X-Deprecated', 'true')
  @Header('X-Canonical-Route', '/v1/inventory-op/issue/:branchId')
  async issueToKitchen(
    @RequestUser() user: JwtPayload,
    @Body() body: IssueToKitchenDto,
  ) {
    const clientId = requireClientId(user);
    const branchId = requireActiveBranchMatch(user, body.branch_id);
    return this.inventoryOpService.issueToKitchen(clientId, branchId, body, user);
  }

  @Post('grn-bill/:id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
  @Header('X-Deprecated', 'true')
  @Header('X-Canonical-Route', '/v1/inventory-op/grns/:id/bill')
  async captureGrnBill(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: CaptureGrnBillDto,
  ) {
    return this.inventoryOpService.captureVendorBill(
      requireClientId(user),
      Number(id),
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Get('stock/:branchId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory-op/branch/:branchId')
    async getBranchStock(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: number,
    ) {
        return this.inventoryOpService.getBranchStock(
            requireClientId(user),
            requireActiveBranchMatch(user, branchId),
        );
    }
}
