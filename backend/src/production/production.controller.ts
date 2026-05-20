import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  getAccessibleBranchIds,
  requireClientId,
} from '../auth/request-context.util';
import {
  CompleteProductionOrderDto,
  CreateProductionOrderDto,
  DispatchProductionOrderDto,
  IssueProductionMaterialsDto,
  ProductionDecisionDto,
  ProductionOrderQueryDto,
  ReceiveProductionOrderDto,
} from './dto/production-order.dto';
import { ProductionService } from './production.service';

@Controller('v1/production')
@UseGuards(JwtAuthGuard)
@RequireFeature('production', 'production management')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async createOrder(
    @RequestUser() user: JwtPayload,
    @Body() body: CreateProductionOrderDto,
  ) {
    return this.productionService.createProductionOrder(
      requireClientId(user),
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getOrders(
    @RequestUser() user: JwtPayload,
    @Query() query: ProductionOrderQueryDto,
  ) {
    return this.productionService.getOrders(
      requireClientId(user),
      getAccessibleBranchIds(user),
      query,
    );
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async getOrder(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productionService.getOrder(
      requireClientId(user),
      id,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/queue')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async queueProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ProductionDecisionDto,
  ) {
    return this.productionService.queueProduction(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/issue')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async issueMaterials(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: IssueProductionMaterialsDto,
  ) {
    return this.productionService.issueMaterials(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/reject')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async rejectProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ProductionDecisionDto,
  ) {
    return this.productionService.rejectProduction(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/cancel')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async cancelProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ProductionDecisionDto,
  ) {
    return this.productionService.cancelProduction(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/start')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async startProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productionService.startProduction(
      requireClientId(user),
      id,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/complete')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async completeProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CompleteProductionOrderDto,
  ) {
    return this.productionService.completeProduction(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/dispatch')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async dispatchProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DispatchProductionOrderDto,
  ) {
    return this.productionService.dispatchProduction(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/receive')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE)
  async receiveProduction(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReceiveProductionOrderDto,
  ) {
    return this.productionService.receiveProduction(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }
}
