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
  requireClientId,
} from '../../auth/request-context.util';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import {
  CreateProcurementRequestDto,
  ReviewProcurementRequestDto,
} from '../dto/inventory-op.dto';
import { ProcurementRequestsService } from './procurement-requests.service';

@Controller('v1/inventory-op/procurement-requests')
@UseGuards(JwtAuthGuard)
export class ProcurementRequestsController {
  constructor(
    private readonly procurementRequestsService: ProcurementRequestsService,
  ) {}

  @Post()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async create(
    @RequestUser() user: JwtPayload,
    @Body() body: CreateProcurementRequestDto,
  ) {
    return this.procurementRequestsService.create(
      requireClientId(user),
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async findAll(
    @RequestUser() user: JwtPayload,
    @Query('status') status?: 'pending' | 'approved' | 'rejected' | 'converted',
  ) {
    return this.procurementRequestsService.findAll(
      requireClientId(user),
      getAccessibleBranchIds(user),
      { status },
    );
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
  async findOne(@RequestUser() user: JwtPayload, @Param('id') id: number) {
    return this.procurementRequestsService.findOne(
      requireClientId(user),
      id,
      getAccessibleBranchIds(user),
    );
  }

  @Post(':id/review')
  @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
  async review(
    @RequestUser() user: JwtPayload,
    @Param('id') id: number,
    @Body() body: ReviewProcurementRequestDto,
  ) {
    return this.procurementRequestsService.review(
      requireClientId(user),
      id,
      body,
      user,
      getAccessibleBranchIds(user),
    );
  }
}
