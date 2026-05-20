import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { OrderTypeService } from './order-type.service';
import { CreateOrderTypeDto, UpdateOrderTypeDto } from './dto/order-type.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequireAnyPermissions } from '../../auth/decorators/permissions.decorator';
import { RequestUser } from '../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';

@Controller('v1/master-data/order-types')
@UseGuards(JwtAuthGuard)
export class OrderTypeController {
    constructor(private readonly orderTypeService: OrderTypeService) { }

    @Post()
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE)
    create(@RequestUser() user: JwtPayload, @Body() createOrderTypeDto: CreateOrderTypeDto) {
        return this.orderTypeService.create(user.client_id!, createOrderTypeDto);
    }

    @Get()
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE)
    findAll(@RequestUser() user: JwtPayload) {
        return this.orderTypeService.findAll(user.client_id!);
    }

    @Get(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.READ, APP_PERMISSIONS.CATALOG.WRITE)
    findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        return this.orderTypeService.findOne(user.client_id!, +id);
    }

    @Patch(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE)
    update(@RequestUser() user: JwtPayload, @Param('id') id: string, @Body() updateOrderTypeDto: UpdateOrderTypeDto) {
        return this.orderTypeService.update(user.client_id!, +id, updateOrderTypeDto);
    }

    @Delete(':id')
    @RequireAnyPermissions(APP_PERMISSIONS.CATALOG.WRITE)
    remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        return this.orderTypeService.remove(user.client_id!, +id);
    }
}
