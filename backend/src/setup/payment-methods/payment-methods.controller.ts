import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { requireClientId } from '../../auth/request-context.util';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto/payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('v1/setup/payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post()
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  create(@RequestUser() user: JwtPayload, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(requireClientId(user), dto);
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  findAll(@RequestUser() user: JwtPayload) {
    return this.paymentMethodsService.findAll(requireClientId(user));
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  update(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdatePaymentMethodDto) {
    return this.paymentMethodsService.update(requireClientId(user), Number(id), dto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.paymentMethodsService.remove(requireClientId(user), Number(id));
    return { message: 'Payment method archived successfully' };
  }
}
