import { Controller, Post, Get, Body, UseGuards, Put, Param, Delete, Patch } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemOnlyGuard } from '../auth/guards/system-only.guard';
import { RequestUser } from '../auth/decorators/user.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from './dto/subscription-plan.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { APP_PERMISSIONS } from '../auth/constants/permissions';

@Controller('v1/platform')
@UseGuards(JwtAuthGuard, SystemOnlyGuard)
@RequirePermissions(APP_PERMISSIONS.PLATFORM.SUPER_ADMIN)
export class PlatformController {
    constructor(
        private readonly platformService: PlatformService
    ) { }

    @Get('settings')
    @UseGuards(JwtAuthGuard)
    async getSettings(@RequestUser() UserManagement: JwtPayload) {
        return this.platformService.getSettings(UserManagement.client_id!);
    }

    @Put('settings')
    @UseGuards(JwtAuthGuard)
    async updateSettings(@RequestUser() UserManagement: JwtPayload, @Body() dto: any) {
        return this.platformService.updateSettings(UserManagement.client_id!, dto);
    }

    @Get('system-settings')
    @UseGuards(JwtAuthGuard)
    async getSystemSettings() {
        return this.platformService.getSystemSettings();
    }

    @Put('system-settings')
    @UseGuards(JwtAuthGuard)
    async updateSystemSettings(@Body() dto: any) {
        return this.platformService.updateSystemSettings(dto);
    }

    @Get('plans')
    async getPlans() {
        return this.platformService.findAllPlans();
    }

    @Get('plans/:id')
    async getPlan(@Param('id') id: string) {
        return this.platformService.findPlanById(id);
    }

    @Post('plans')
    @UseGuards(JwtAuthGuard)
    async createPlan(@Body() dto: CreateSubscriptionPlanDto, @RequestUser() user: JwtPayload) {
        return this.platformService.createPlan(dto, user);
    }

    @Put('plans/:id')
    @UseGuards(JwtAuthGuard)
    async updatePlan(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto, @RequestUser() user: JwtPayload) {
        return this.platformService.updatePlan(id, dto, user);
    }

    @Patch('plans/:id/status')
    @UseGuards(JwtAuthGuard)
    async updatePlanStatus(
        @Param('id') id: string,
        @Body() dto: { plan_status: 'draft' | 'active' | 'retired' },
        @RequestUser() user: JwtPayload,
    ) {
        return this.platformService.updatePlanStatus(id, dto.plan_status, user);
    }

    @Delete('plans/:id')
    @UseGuards(JwtAuthGuard)
    async deletePlan(@Param('id') id: string) {
        return this.platformService.deletePlan(id);
    }

    @Post('system-users')
    @UseGuards(JwtAuthGuard)
    async createSystemUser(@Body() dto: any) {
        return this.platformService.createSystemUserManagement(dto);
    }

    @Get('system-users')
    @UseGuards(JwtAuthGuard)
    async getAllSystemUsers() {
        return this.platformService.findAllSystemUserManagements();
    }

    @Get('system-users/:id')
    @UseGuards(JwtAuthGuard)
    async getSystemUser(@Param('id') id: string) {
        return this.platformService.findSystemUserManagementById(+id);
    }

    @Put('system-users/:id')
    @UseGuards(JwtAuthGuard)
    async updateSystemUser(@Param('id') id: string, @Body() dto: any) {
        return this.platformService.updateSystemUserManagement(+id, dto);
    }

    @Delete('system-users/:id')
    @UseGuards(JwtAuthGuard)
    async deactivateSystemUser(@Param('id') id: string) {
        return this.platformService.deactivateSystemUserManagement(+id);
    }

    @Post('system-users/:id/activate')
    @UseGuards(JwtAuthGuard)
    async activateSystemUser(@Param('id') id: string) {
        return this.platformService.activateSystemUserManagement(+id);
    }

    // ─── Departments ─────────────────────────────────────────────────────────

    @Get('Departments')
    getDepartments() {
        return this.platformService.findAllDepartments();
    }

    @Post('Departments')
    createDepartments(@Body() dto: any) {
        return this.platformService.createDepartments(dto);
    }

    @Put('Departments/:id')
    updateDepartments(@Param('id') id: string, @Body() dto: any) {
        return this.platformService.updateDepartments(+id, dto);
    }

    @Delete('Departments/:id')
    removeDepartments(@Param('id') id: string) {
        return this.platformService.removeDepartments(+id);
    }

    // ─── Designations ────────────────────────────────────────────────────────

    @Get('designations')
    getDesignations() {
        return this.platformService.findAllDesignations();
    }

    @Post('designations')
    createDesignation(@Body() dto: any) {
        return this.platformService.createDesignation(dto);
    }

    @Put('designations/:id')
    updateDesignation(@Param('id') id: string, @Body() dto: any) {
        return this.platformService.updateDesignation(+id, dto);
    }

    @Delete('designations/:id')
    removeDesignation(@Param('id') id: string) {
        return this.platformService.removeDesignation(+id);
    }
}
