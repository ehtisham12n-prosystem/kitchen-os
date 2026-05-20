import { Controller, Get, Post, Body, Param, Put, Delete, Query, Request, UseGuards } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { Theme } from '../entities/theme.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../../auth/guards/system-only.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('v1/platform/themes')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
export class ThemesController {
    constructor(private readonly themesService: ThemesService) { }

    // ── Public endpoint — any UserManagement/portal can fetch the token list ────────
    @Public()
    @Get('active')
    getActive(@Query('client_id') client_id?: string) {
        return this.themesService.findActive(client_id);
    }

    // ── List all themes (global or client-scoped) ─────────────────────────
    @Get()
    findAll(@Query('client_id') client_id?: string) {
        return this.themesService.findAll(client_id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.themesService.findOne(id);
    }

    // ── Create a custom theme (Nexus Admin only) ───────────────────────────
    @Post()
    create(@Body() createThemeDto: Partial<Theme>, @Request() req) {
        return this.themesService.create(createThemeDto, req.user?.id ?? 1);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateThemeDto: Partial<Theme>) {
        return this.themesService.update(id, updateThemeDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.themesService.remove(id);
    }

    // ── Activate a theme (sets is_active = true, deactivates previous) ────
    @Post(':id/activate')
    activateTheme(@Param('id') id: string, @Query('client_id') client_id?: string) {
        return this.themesService.activateTheme(id, client_id);
    }

    // ── Seed default system themes (Nexus Admin only — safe / idempotent) ──
    @Post('admin/seed')
    seedDefaults() {
        return this.themesService.seedDefaults();
    }

    // ── Force re-seed: refresh all system theme tokens (Nexus Admin only) ──
    @Post('admin/reseed')
    reseedDefaults() {
        return this.themesService.reseedDefaults();
    }
}
