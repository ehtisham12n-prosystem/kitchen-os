import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
  CreateCustomerDto,
  CustomerPurchaseHistoryDto,
  ListCustomersDto,
  LoyaltyAdjustmentDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { requireClientId } from '../auth/request-context.util';

@Controller('v1/customers')
@UseGuards(JwtAuthGuard)
@RequireFeature('crm', 'customer CRM')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequireAnyPermissions(
    APP_PERMISSIONS.CRM.CUSTOMERS_CREATE,
    APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
    APP_PERMISSIONS.POS.ORDER_CREATE,
  )
  async createCustomer(@RequestUser() user: JwtPayload, @Body() body: CreateCustomerDto) {
    return this.customersService.createCustomer(requireClientId(user), body);
  }

  @Get()
  @RequireAnyPermissions(
    APP_PERMISSIONS.CRM.CUSTOMERS,
    APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
    APP_PERMISSIONS.POS.ORDER_READ,
    APP_PERMISSIONS.POS.ORDER_CREATE,
    APP_PERMISSIONS.POS.CASHIER_CONSOLE,
    APP_PERMISSIONS.POS.CREDIT_SETTLE,
  )
  async getCustomers(@RequestUser() user: JwtPayload, @Query() query: ListCustomersDto) {
    return this.customersService.getCustomers(requireClientId(user), query);
  }

  @Get('summary')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CUSTOMERS, APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE)
  async getCustomerSummary(@RequestUser() user: JwtPayload) {
    return this.customersService.getCustomerSummary(requireClientId(user));
  }

  @Get('search')
  @RequireAnyPermissions(
    APP_PERMISSIONS.CRM.CUSTOMERS,
    APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
    APP_PERMISSIONS.POS.ORDER_READ,
    APP_PERMISSIONS.POS.ORDER_CREATE,
  )
  async searchCustomer(@RequestUser() user: JwtPayload, @Query('phone') phone: string) {
    return this.customersService.findByPhone(requireClientId(user), phone);
  }

  @Get(':id')
  @RequireAnyPermissions(
    APP_PERMISSIONS.CRM.CUSTOMERS,
    APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
    APP_PERMISSIONS.POS.ORDER_READ,
    APP_PERMISSIONS.POS.ORDER_CREATE,
    APP_PERMISSIONS.POS.CASHIER_CONSOLE,
    APP_PERMISSIONS.POS.CREDIT_SETTLE,
  )
  async getCustomerDetail(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.getCustomerDetail(requireClientId(user), Number(id));
  }

  @Patch(':id')
  @RequireAnyPermissions(
    APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE,
    APP_PERMISSIONS.POS.CREDIT_SETTLE,
  )
  async updateCustomer(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(requireClientId(user), Number(id), body);
  }

  @Get(':id/purchase-history')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CUSTOMERS, APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE)
  async getPurchaseHistory(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: CustomerPurchaseHistoryDto,
  ) {
    return this.customersService.getPurchaseHistory(requireClientId(user), Number(id), query.limit);
  }

  @Get(':id/loyalty-ledger')
  @RequireAnyPermissions(APP_PERMISSIONS.CRM.CUSTOMERS, APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE)
  async getLoyaltyLedger(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.customersService.getLoyaltyLedger(
      requireClientId(user),
      Number(id),
      limit ? Number(limit) : undefined,
    );
  }

  @Post(':id/loyalty-adjustments')
  @RequirePermissions(APP_PERMISSIONS.CRM.CUSTOMERS_MANAGE)
  async adjustLoyalty(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: LoyaltyAdjustmentDto,
  ) {
    const actorId = typeof user.sub === 'string' ? Number(user.sub) : Number(user.sub ?? 0);
    return this.customersService.adjustLoyaltyPoints(
      requireClientId(user),
      Number(id),
      body.points_delta,
      body.remarks,
      Number.isFinite(actorId) ? actorId : undefined,
    );
  }
}
