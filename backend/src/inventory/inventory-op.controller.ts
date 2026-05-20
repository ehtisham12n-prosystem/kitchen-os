import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import {
    AdjustStockDto,
    CreatePurchaseOrderDto,
    ReceiveStockDto,
} from '../inventory-op/dto/inventory-op.dto';
import { InventoryOpService as CanonicalInventoryOpService } from '../inventory-op/inventory-op.service';
import { PurchaseOrdersService } from '../inventory-op/purchase-orders/purchase-orders.service';

@Controller('v1/inventory-op')
@UseGuards(JwtAuthGuard)
export class InventoryOpController {
    constructor(
        private readonly opService: CanonicalInventoryOpService,
        private readonly purchaseOrdersService: PurchaseOrdersService,
    ) {}

    @Get('branch/:branchId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async getBranchStock(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: string,
    ) {
        return this.opService.getBranchStock(
            requireClientId(user),
            requireActiveBranchMatch(user, Number(branchId)),
        );
    }

    @Post('adjust/:branchId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    async adjustStock(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: string,
        @Body() body: AdjustStockDto,
    ) {
        const activeBranchId = requireActiveBranchMatch(user, Number(branchId));
        return this.opService.adjustStock(requireClientId(user), activeBranchId, body, user);
    }

    @Post('receive/:branchId/:poId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
    async receivePO(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: string,
        @Param('poId') poId: string,
    ) {
        const activeBranchId = requireActiveBranchMatch(user, Number(branchId));
        return this.opService.receivePurchaseOrder(
            requireClientId(user),
            activeBranchId,
            Number(poId),
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
        const branchId = requireActiveBranchMatch(user, body.branch_id);
        return this.opService.receiveStock(
            requireClientId(user),
            branchId,
            body,
            user,
            getAccessibleBranchIds(user),
        );
    }

    @Get('grns')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async listGrns(@RequestUser() user: JwtPayload) {
        return this.opService.listGoodsReceipts(
            requireClientId(user),
            getAccessibleBranchIds(user),
        );
    }

    @Get('grns/:id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async getGrn(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        return this.opService.getGoodsReceipt(
            requireClientId(user),
            Number(id),
            getAccessibleBranchIds(user),
        );
    }

    @Get('ledger/:branchId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async getLedger(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: string,
        @Query('itemId') itemId?: string,
        @Query('transactionType') transactionType?: string,
        @Query('limit') limit?: string,
    ) {
        return this.opService.getStockLedger(
            requireClientId(user),
            requireActiveBranchMatch(user, Number(branchId)),
            {
                itemId: itemId ? Number(itemId) : undefined,
                transactionType,
                limit: limit ? Number(limit) : undefined,
            },
        );
    }

    @Get('dashboard/:branchId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async getInventoryDashboard(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: string,
    ) {
        return this.opService.getInventoryDashboard(
            requireClientId(user),
            requireActiveBranchMatch(user, Number(branchId)),
        );
    }

    @Post('po/:branchId')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    async createPO(
        @RequestUser() user: JwtPayload,
        @Param('branchId') branchId: string,
        @Body() body: CreatePurchaseOrderDto,
    ) {
        const activeBranchId = requireActiveBranchMatch(user, Number(branchId));
        return this.purchaseOrdersService.create(
            requireClientId(user),
            { ...body, branch_id: activeBranchId },
            user,
            getAccessibleBranchIds(user),
        );
    }
}
