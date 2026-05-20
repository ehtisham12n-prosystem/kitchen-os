import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentsDto, UpdateDepartmentsDto } from './dto/Departments.dto';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { requireClientId } from '../../auth/request-context.util';

@Controller('v1/setup/departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @Post()
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_WRITE)
    async create(@RequestUser() user: JwtPayload, @Body() dto: CreateDepartmentsDto) {
        return this.departmentsService.create(requireClientId(user), dto);
    }

    @Get()
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
    async findAll(@RequestUser() user: JwtPayload) {
        return this.departmentsService.findAll(requireClientId(user));
    }

    @Get(':id')
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
    async findOne(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        return this.departmentsService.findOne(requireClientId(user), +id);
    }

    @Put(':id')
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_WRITE)
    async update(
        @RequestUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: UpdateDepartmentsDto,
    ) {
        return this.departmentsService.update(requireClientId(user), +id, dto);
    }

    @Delete(':id')
    @RequirePermissions(APP_PERMISSIONS.HR.STAFF_WRITE)
    async remove(@RequestUser() user: JwtPayload, @Param('id') id: string) {
        await this.departmentsService.remove(requireClientId(user), +id);
        return { message: 'Department deleted successfully' };
    }
}
