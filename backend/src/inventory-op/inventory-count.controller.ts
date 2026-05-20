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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  getAccessibleBranchIds,
  requireBranchId,
  requireClientId,
} from '../auth/request-context.util';
import { InventoryCountService } from './inventory-count.service';
import {
  CreateInventoryCountSessionDto,
  ListInventoryCountSessionsQueryDto,
  ReviewInventoryCountSessionDto,
  SubmitInventoryCountSessionDto,
} from './dto/inventory-count.dto';

@Controller('v1/inventory-op/counts')
@UseGuards(JwtAuthGuard)
export class InventoryCountController {
  constructor(private readonly inventoryCountService: InventoryCountService) {}

  @Get('dashboard/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_REPORT)
  async getDashboard(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    return this.inventoryCountService.getDashboard(
      requireClientId(user),
      requireBranchId(user, branchId),
      getAccessibleBranchIds(user),
    );
  }

  @Get('closing-dashboard/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_REPORT)
  async getClosingDashboard(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
  ) {
    return this.inventoryCountService.getClosingDashboard(
      requireClientId(user),
      requireBranchId(user, branchId),
      getAccessibleBranchIds(user),
    );
  }

  @Get('branch/:branchId')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_VIEW)
  async listSessions(
    @RequestUser() user: JwtPayload,
    @Param('branchId') branchId: number,
    @Query() query: ListInventoryCountSessionsQueryDto,
  ) {
    return this.inventoryCountService.listSessions(
      requireClientId(user),
      requireBranchId(user, branchId),
      query,
      getAccessibleBranchIds(user),
    );
  }

  @Post()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE)
  async createSession(
    @RequestUser() user: JwtPayload,
    @Body() body: CreateInventoryCountSessionDto,
  ) {
    return this.inventoryCountService.createSession(
      requireClientId(user),
      requireBranchId(user, body.branch_id),
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_VIEW)
  async getSession(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.inventoryCountService.getSession(
      requireClientId(user),
      Number(id),
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/submit')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_PERFORM)
  async submitSession(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: SubmitInventoryCountSessionDto,
  ) {
    return this.inventoryCountService.submitSession(
      requireClientId(user),
      Number(id),
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/review')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.COUNT_REVIEW)
  async reviewSession(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: ReviewInventoryCountSessionDto,
  ) {
    return this.inventoryCountService.reviewSession(
      requireClientId(user),
      Number(id),
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }
}
