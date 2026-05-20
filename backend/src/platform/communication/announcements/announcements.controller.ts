import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../../auth/guards/system-only.guard';
import { RequestUser } from '../../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../../auth/payloads/jwt-payload.interface';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, UpdateAnnouncementStatusDto } from '../dto/announcement.dto';
import { Public } from '../../../auth/decorators/public.decorator';

@Controller('v1/platform/announcements')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
export class AnnouncementsController {
    constructor(private readonly service: AnnouncementsService) { }

    @Get()
    async findAll() {
        return this.service.findAll();
    }

    @Public()
    @Get('active')
    async findActive() {
        return this.service.findActive();
    }

    @Post()
    async create(@RequestUser() UserManagement: JwtPayload, @Body() dto: CreateAnnouncementDto) {
        return this.service.create(dto, UserManagement.sub.toString());
    }

    @Put(':id/status')
    async updateStatus(@Param('id') id: string, @Body() dto: UpdateAnnouncementStatusDto) {
        return this.service.updateStatus(id, dto);
    }

    @Public()
    @Post(':id/view')
    async incrementViews(@Param('id') id: string) {
        return this.service.incrementViews(id);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}
