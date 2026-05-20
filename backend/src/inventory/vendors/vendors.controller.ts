import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { requireClientId } from '../../auth/request-context.util';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { CreateVendorDto, UpdateVendorDto } from '../dto/inventory-write.dto';
import { VendorsService } from './vendors.service';

@Controller('v1/inventory/vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
    constructor(private readonly vendorsService: VendorsService) {}

    @Post()
    @RequirePermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    async create(@RequestUser() user: JwtPayload, @Body() body: CreateVendorDto) {
        return this.vendorsService.create(requireClientId(user), body);
    }

    @Get()
    @RequireAnyPermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS, APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    async findAll(@RequestUser() user: JwtPayload) {
        return this.vendorsService.findAll(requireClientId(user));
    }

    @Get(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS, APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    async findOne(@RequestUser() user: JwtPayload, @Param('id') id: number) {
        return this.vendorsService.findOne(requireClientId(user), id);
    }

    @Post(':id')
    @RequirePermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors/:id')
    async update(
        @RequestUser() user: JwtPayload,
        @Param('id') id: number,
        @Body() body: UpdateVendorDto,
    ) {
        return this.vendorsService.update(requireClientId(user), id, body);
    }

    @Post(':id/delete')
    @RequirePermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors/:id')
    async delete(@RequestUser() user: JwtPayload, @Param('id') id: number) {
        return this.vendorsService.delete(requireClientId(user), id);
    }

    @Put(':id')
    @RequirePermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    async updateCanonical(
        @RequestUser() user: JwtPayload,
        @Param('id') id: number,
        @Body() body: UpdateVendorDto,
    ) {
        return this.vendorsService.update(requireClientId(user), id, body);
    }

    @Delete(':id')
    @RequirePermissions(APP_PERMISSIONS.PROCUREMENT.VENDORS_MANAGE)
    async deleteCanonical(@RequestUser() user: JwtPayload, @Param('id') id: number) {
        return this.vendorsService.delete(requireClientId(user), id);
    }
}
