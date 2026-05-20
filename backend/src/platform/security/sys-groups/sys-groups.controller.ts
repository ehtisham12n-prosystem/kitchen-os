import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SysGroupsService } from './sys-groups.service';
import { CreateSysGroupDto, UpdateSysGroupDto } from './dto/system-group.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../../auth/guards/system-only.guard';
import { RequestUser } from '../../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../../auth/payloads/jwt-payload.interface';

@Controller('v1/platform/groups')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
export class SysGroupsController {
    constructor(private readonly groupsService: SysGroupsService) { }

    @Get()
    async findAll() {
        return this.groupsService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.groupsService.findOne(id);
    }

    @Post()
    async create(@Body() dto: CreateSysGroupDto, @RequestUser() user: JwtPayload) {
        return this.groupsService.create(dto, user.sub.toString());
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateSysGroupDto) {
        return this.groupsService.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.groupsService.remove(id);
    }
}

