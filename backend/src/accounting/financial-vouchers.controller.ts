import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireAnyPermissions } from '../auth/decorators/permissions.decorator';
import {
  getAccessibleBranchIds,
  getOptionalBranchId,
  requireBranchId,
  requireClientId,
  resolveActorId,
} from '../auth/request-context.util';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { CreateFinancialVoucherDto, UpdateFinancialVoucherStatusDto } from './dto/accounting-write.dto';
import { FinancialVouchersService } from './financial-vouchers.service';
import { VoucherType } from './entities/financial-voucher.entity';

@Controller('v1/financial-vouchers')
@UseGuards(JwtAuthGuard)
export class FinancialVouchersController {
  constructor(private readonly vouchersService: FinancialVouchersService) {}

  @Post()
  @RequireAnyPermissions(
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
  )
  async create(
    @RequestUser() user: JwtPayload,
    @Body() body: CreateFinancialVoucherDto,
  ) {
    const branchId = requireBranchId(user, body.branch_id);
    return this.vouchersService.create(
      requireClientId(user),
      branchId,
      body,
      resolveActorId(user),
      user,
    );
  }

  @Get()
  @RequireAnyPermissions(
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
  )
  async findAll(
    @RequestUser() user: JwtPayload,
    @Query('type') type?: VoucherType,
    @Query('branch_id') branch_id?: number,
  ) {
    const effectiveBranchId = getOptionalBranchId(user, branch_id);
    return this.vouchersService.findAll(
      requireClientId(user),
      effectiveBranchId,
      type,
      getAccessibleBranchIds(user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions(
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
  )
  async findOne(@RequestUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.vouchersService.findOne(requireClientId(user), id, getAccessibleBranchIds(user));
  }

  @Get(':id/payment-preview')
  @RequireAnyPermissions(
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ,
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
  )
  async getVendorPaymentPreview(@RequestUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.vouchersService.getVendorPaymentPreview(
      requireClientId(user),
      id,
      getAccessibleBranchIds(user),
    );
  }

  @Put(':id')
  @RequireAnyPermissions(
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
  )
  async update(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateFinancialVoucherDto,
  ) {
    return this.vouchersService.update(
      requireClientId(user),
      id,
      body,
      getAccessibleBranchIds(user),
      getOptionalBranchId(user, body.branch_id),
      resolveActorId(user),
      user,
    );
  }

  @Patch(':id/status')
  @RequireAnyPermissions(
    APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_MANAGE,
    APP_PERMISSIONS.ACCOUNTING.VOUCHER_APPROVE,
  )
  async updateStatus(
    @RequestUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateFinancialVoucherStatusDto,
  ) {
    return this.vouchersService.updateStatus(
      requireClientId(user),
      id,
      body,
      getAccessibleBranchIds(user),
      resolveActorId(user),
      user,
    );
  }
}
