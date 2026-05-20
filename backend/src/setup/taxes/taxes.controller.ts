import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { requireClientId } from '../../auth/request-context.util';
import { TaxesService } from './taxes.service';
import {
  CreateTaxConfigurationDto,
  UpdateTaxConfigurationDto,
} from './dto/tax.dto';

@Controller('v1/setup/taxes')
@UseGuards(JwtAuthGuard)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Post()
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  create(@RequestUser() user: JwtPayload, @Body() dto: CreateTaxConfigurationDto) {
    return this.taxesService.create(requireClientId(user), dto);
  }

  @Get()
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  findAll(@RequestUser() user: JwtPayload) {
    return this.taxesService.findAll(requireClientId(user));
  }

  @Get(':id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.READ)
  findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    return this.taxesService.findOne(requireClientId(user), Number(id));
  }

  @Patch(':id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  update(
    @RequestUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaxConfigurationDto,
  ) {
    return this.taxesService.update(requireClientId(user), Number(id), dto);
  }

  @Delete(':id')
  @RequirePermissions(APP_PERMISSIONS.CATALOG.WRITE)
  async remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
    await this.taxesService.remove(requireClientId(user), Number(id));
    return { message: 'Tax configuration archived successfully' };
  }
}
