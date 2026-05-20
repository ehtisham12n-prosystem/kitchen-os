import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../../auth/guards/system-only.guard';
import { RequestUser } from '../../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../../auth/payloads/jwt-payload.interface';
import { SupportService } from './support.service';
import { CreateTicketDto, CreateMessageDto, UpdateTicketStatusDto } from '../dto/support.dto';

@Controller('v1/platform/support')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
export class SupportController {
    constructor(private readonly service: SupportService) { }

    @Get('tickets')
    async findAll() {
        return this.service.findAll();
    }

    @Get('tickets/:id')
    async findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Post('tickets')
    async create(@RequestUser() UserManagement: JwtPayload, @Body() dto: CreateTicketDto) {
        return this.service.create(dto, UserManagement.sub.toString(), 'Platform Support');
    }

    @Post('tickets/:id/messages')
    async addMessage(@Param('id') id: string, @RequestUser() UserManagement: JwtPayload, @Body() dto: CreateMessageDto) {
        const isSupport = true;
        return this.service.addMessage(id, dto, UserManagement.sub.toString(), 'Platform Support', isSupport);
    }

    @Put('tickets/:id/status')
    async updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
        return this.service.updateStatus(id, dto);
    }
}
