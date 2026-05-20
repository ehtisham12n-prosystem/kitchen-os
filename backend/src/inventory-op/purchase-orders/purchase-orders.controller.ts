import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import {
    getAccessibleBranchIds,
    requireBranchId,
    requireClientId,
} from '../../auth/request-context.util';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import {
    CreatePurchaseOrderDto,
    ListPurchaseOrdersQueryDto,
    UpdatePurchaseOrderApprovalDto,
    UpdatePurchaseOrderStatusDto,
} from '../dto/inventory-op.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('v1/inventory-op/purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
    constructor(private readonly poService: PurchaseOrdersService) {}

    @Post()
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    async create(@RequestUser() user: JwtPayload, @Body() body: CreatePurchaseOrderDto) {
        const branchId = requireBranchId(user, body.branch_id);
        return this.poService.create(
            requireClientId(user),
            { ...body, branch_id: branchId },
            user,
            getAccessibleBranchIds(user),
        );
    }

    @Get()
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async findAll(
        @RequestUser() user: JwtPayload,
        @Query() query: ListPurchaseOrdersQueryDto,
    ) {
        const clientId = requireClientId(user);
        const accessibleBranchIds = getAccessibleBranchIds(user);
        if (query.paginate) {
            return this.poService.findAllPaginated(clientId, accessibleBranchIds, query);
        }

        return this.poService.findAll(clientId, accessibleBranchIds);
    }

    @Get(':id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    async findOne(@RequestUser() user: JwtPayload, @Param('id') id: number) {
        return this.poService.findOne(requireClientId(user), id, getAccessibleBranchIds(user));
    }

    @Post(':id/status')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    async updateStatus(
        @RequestUser() user: JwtPayload,
        @Param('id') id: number,
        @Body() body: UpdatePurchaseOrderStatusDto,
    ) {
        return this.poService.updateStatus(
            requireClientId(user),
            id,
            body.status,
            getAccessibleBranchIds(user),
        );
    }

    @Post(':id/approval')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    async updateApproval(
        @RequestUser() user: JwtPayload,
        @Param('id') id: number,
        @Body() body: UpdatePurchaseOrderApprovalDto,
    ) {
        return this.poService.updateApproval(
            requireClientId(user),
            id,
            body,
            user,
            getAccessibleBranchIds(user),
        );
    }

    @Post(':id/delete')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    async delete(@RequestUser() user: JwtPayload, @Param('id') id: number) {
        return this.poService.delete(requireClientId(user), id, getAccessibleBranchIds(user));
    }
}
