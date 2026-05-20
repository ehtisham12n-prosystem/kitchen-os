import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import {
  getAccessibleBranchIds,
  requireClientId,
} from '../../auth/request-context.util';
import {
  CreateInventoryTransferDto,
  DispatchInventoryTransferDto,
  ReceiveInventoryTransferDto,
  TransferDecisionDto,
  TransferFinanceReviewDto,
} from '../dto/inventory-transfer.dto';
import { TransfersService } from './transfers.service';

@Controller('v1/inventory-op/transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async create(@RequestUser() user: JwtPayload, @Body() body: CreateInventoryTransferDto) {
    return this.transfersService.create(
      requireClientId(user),
      body,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async findAll(@RequestUser() user: JwtPayload, @Query('status') status?: string) {
    return this.transfersService.findAll(
      requireClientId(user),
      getAccessibleBranchIds(user),
      { status, flow_type: 'stock_transfer' },
    );
  }

  @Get('branch-options')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getBranchOptions(@RequestUser() user: JwtPayload) {
    return this.transfersService.getBranchOptions(
      requireClientId(user),
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async findOne(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.transfersService.findOne(
      requireClientId(user),
      id,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Post(':id/approve')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async approve(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: TransferDecisionDto,
  ) {
    return this.transfersService.approve(
      requireClientId(user),
      id,
      body.notes,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Post(':id/reject')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async reject(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: TransferDecisionDto,
  ) {
    return this.transfersService.reject(
      requireClientId(user),
      id,
      body.notes,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async cancel(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: TransferDecisionDto,
  ) {
    return this.transfersService.cancel(
      requireClientId(user),
      id,
      body.notes,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Post(':id/dispatch')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async dispatch(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: DispatchInventoryTransferDto,
  ) {
    return this.transfersService.dispatch(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Post(':id/receive')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
  async receive(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: ReceiveInventoryTransferDto,
  ) {
    return this.transfersService.receive(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }

  @Post(':id/finance-review')
  @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.REPORTS)
  async financeReview(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: TransferFinanceReviewDto,
  ) {
    return this.transfersService.markFinanceReviewed(
      requireClientId(user),
      id,
      body.notes,
      user,
      getAccessibleBranchIds(user),
      { flowType: 'stock_transfer' },
    );
  }
}
