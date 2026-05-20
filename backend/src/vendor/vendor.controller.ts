import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Header,
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequestUser } from '../auth/decorators/user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';

@Controller('v1/vendors')
@UseGuards(JwtAuthGuard)
export class VendorController {
    constructor(private readonly vendorService: VendorService) { }

    @Post()
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors')
    async create(@RequestUser() UserManagement: JwtPayload, @Body() body: any) {
        return this.vendorService.create(UserManagement.client_id!, body);
    }

    @Get()
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors')
    async findAll(@RequestUser() UserManagement: JwtPayload) {
        return this.vendorService.findAll(UserManagement.client_id!);
    }

    @Get(':id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.READ)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors/:id')
    async findOne(@RequestUser() UserManagement: JwtPayload, @Param('id') id: number) {
        return this.vendorService.findOne(UserManagement.client_id!, id);
    }

    @Put(':id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors/:id')
    async update(
        @RequestUser() UserManagement: JwtPayload,
        @Param('id') id: number,
        @Body() body: any,
    ) {
        return this.vendorService.update(UserManagement.client_id!, id, body);
    }

    @Delete(':id')
    @RequirePermissions(APP_PERMISSIONS.INVENTORY.STOCK_ADJUST)
    @Header('X-Deprecated', 'true')
    @Header('X-Canonical-Route', '/v1/inventory/vendors/:id')
    async remove(@RequestUser() UserManagement: JwtPayload, @Param('id') id: number) {
        return this.vendorService.remove(UserManagement.client_id!, id);
    }
}
