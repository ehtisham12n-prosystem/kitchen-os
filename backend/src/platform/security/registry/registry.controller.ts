import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../../auth/guards/system-only.guard';
import { RequestUser } from '../../../auth/decorators/user.decorator';
import type { JwtPayload } from '../../../auth/payloads/jwt-payload.interface';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';


@Controller('v1/platform/security/registry')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
export class RegistryController {
    constructor(private readonly registryService: RegistryService) { }

    // ─── Modules ─────────────────────────────────────────────────────────────

    @Get('modules')
    getAllModules() {
        return this.registryService.findAllModules();
    }

    /** Nexus-only: returns only nexus_ prefixed modules for the Nexus portal */
    @Get('nexus-modules')
    getNexusModules() {
        return this.registryService.findNexusModules();
    }

    /** Trigger a full seed of the permission registry (Nexus + Console modules) */
    @Post('seed')
    seedRegistry() {
        return this.registryService.seedAll();
    }

    @Post('modules')
    createModule(@RequestUser() user: JwtPayload, @Body() dto: CreateModuleDto) {
        return this.registryService.createModule(dto, user.sub.toString());
    }

    @Put('modules/:id')
    updateModule(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
        return this.registryService.updateModule(id, dto);
    }

    // ─── Pages ───────────────────────────────────────────────────────────────

    @Post('pages')
    createPage(@RequestUser() user: JwtPayload, @Body() dto: CreatePageDto) {
        return this.registryService.createPage(dto, user.sub.toString());
    }

    @Put('pages/:id')
    updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
        return this.registryService.updatePage(id, dto);
    }

    @Delete('pages/:id')
    deletePage(@Param('id') id: string) {
        return this.registryService.deletePage(id);
    }
}
