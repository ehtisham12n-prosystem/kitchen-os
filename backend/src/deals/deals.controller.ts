import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DealsService } from './deals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { CreateVoucherDto, UpdateVoucherDto, ValidateVoucherDto } from './dto/voucher.dto';
import { getOptionalBranchId, requireClientId } from '../auth/request-context.util';

@Controller('v1/deals')
@UseGuards(JwtAuthGuard)
@RequireFeature('crm', 'marketing and deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post('vouchers')
  @RequirePermissions(APP_PERMISSIONS.CRM.DEALS_MANAGE)
  async createVoucher(@RequestUser() user: JwtPayload, @Body() body: CreateVoucherDto) {
    return this.dealsService.createVoucher(requireClientId(user), body);
  }

  @Patch('vouchers/:id')
  @RequirePermissions(APP_PERMISSIONS.CRM.DEALS_MANAGE)
  async updateVoucher(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateVoucherDto,
  ) {
    return this.dealsService.updateVoucher(requireClientId(user), +id, body);
  }

  @Get('vouchers')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.DEALS, APP_PERMISSIONS.CRM.DEALS_MANAGE)
  async getVouchers(@RequestUser() user: JwtPayload) {
    return this.dealsService.getVouchers(requireClientId(user));
  }

  @Post('vouchers/validate')
  @RequireAnyPermissions(
    APP_PERMISSIONS.CRM.DEALS,
    APP_PERMISSIONS.CRM.DEALS_MANAGE,
    APP_PERMISSIONS.POS.ORDER_READ,
    APP_PERMISSIONS.POS.ORDER_CREATE,
  )
  async validateVoucher(
    @RequestUser() user: JwtPayload,
    @Body() body: ValidateVoucherDto,
  ) {
    return this.dealsService.validateVoucher(requireClientId(user), body.code, body.order_total, {
      branchId: getOptionalBranchId(user, body.branch_id),
      customerId: body.customer_id,
      orderType: body.order_type,
    });
  }

  @Get('vouchers/redemptions/recent')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.DEALS, APP_PERMISSIONS.CRM.DEALS_MANAGE)
  async getRecentRedemptions(@RequestUser() user: JwtPayload) {
    return this.dealsService.getRecentRedemptions(requireClientId(user));
  }
}
