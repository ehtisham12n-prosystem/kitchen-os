import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/Designation.dto';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { requireClientId } from '../../auth/request-context.util';

@Controller('v1/setup/designations')
@UseGuards(JwtAuthGuard)
export class DesignationsController {
    constructor(private readonly designationsService: DesignationsService) { }

    @Post()
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
    async create(@RequestUser() user: JwtPayload, @Body() dto: CreateDesignationDto) {
        return this.designationsService.create(requireClientId(user), dto);
    }

    @Get()
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
    async findAll(@RequestUser() user: JwtPayload) {
        return this.designationsService.findAll(requireClientId(user));
    }

    @Get(':id')
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
    async findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        return this.designationsService.findOne(requireClientId(user), +id);
    }

    @Put(':id')
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
    async update(
        @RequestUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: UpdateDesignationDto,
    ) {
        return this.designationsService.update(requireClientId(user), +id, dto);
    }

    @Delete(':id')
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SECURITY_USERS)
    async remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        await this.designationsService.remove(requireClientId(user), +id);
        return { message: 'Designation deleted successfully' };
    }
}
