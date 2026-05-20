import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemGroup } from './entities/system-group.entity';
import { CreateSysGroupDto, UpdateSysGroupDto } from './dto/system-group.dto';
import { DEFAULT_ROLE_TEMPLATES } from '../../../auth/constants/role-templates';

@Injectable()
export class SysGroupsService {
    constructor(
        @InjectRepository(SystemGroup)
        private readonly groupRepo: Repository<SystemGroup>,
    ) { }

    private normalizePermissions(permissions?: string[] | null): string[] {
        return Array.from(new Set((permissions ?? []).filter(Boolean)));
    }

    async findAll() {
        return this.groupRepo.find({ order: { created_at: 'DESC' } });
    }

    async findOne(id: string) {
        return this.groupRepo.findOne({ where: { id } });
    }

    async create(dto: CreateSysGroupDto, adminId: string) {
        const existing = await this.groupRepo.findOne({ where: { name: dto.group_name } });
        if (existing) throw new BadRequestException('Group name already exists');

        const group = this.groupRepo.create({
            name: dto.group_name,
            description: dto.description,
            permissions: this.normalizePermissions(dto.permissions),
            is_active: dto.is_active ?? true,
            scope: dto.scope || 'nexus',
            is_template: dto.is_template ?? false,
            created_by: adminId,
        });

        return this.groupRepo.save(group);
    }

    async update(id: string, dto: UpdateSysGroupDto) {
        const group = await this.findOne(id);
        if (!group) throw new BadRequestException('Group not found');
        if (group.is_system_default) throw new BadRequestException('Cannot modify immutable system group');

        const updateData: Record<string, unknown> = {};
        if (dto.group_name) updateData.name = dto.group_name;
        if (dto.description) updateData.description = dto.description;
        if (dto.permissions) updateData.permissions = this.normalizePermissions(dto.permissions);
        if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

        await this.groupRepo.update(id, updateData);
        return this.findOne(id);
    }

    async remove(id: string) {
        const group = await this.findOne(id);
        if (!group) throw new BadRequestException('Group not found');
        if (group.is_system_default) throw new BadRequestException('Cannot delete system default group');

        return this.groupRepo.delete(id);
    }

    async syncFullControlPermissions() {
        const fullControlGroup = await this.groupRepo.findOne({ where: { name: 'System Full Control' } });
        if (fullControlGroup) {
            fullControlGroup.permissions = this.normalizePermissions(['all']);
            await this.groupRepo.save(fullControlGroup);
        }

        const nexusSuperAdmin = await this.groupRepo.findOne({ where: { name: 'Nexus Super Admin' } });
        if (nexusSuperAdmin) {
            nexusSuperAdmin.permissions = this.normalizePermissions(['all']);
            await this.groupRepo.save(nexusSuperAdmin);
        }
    }

    async seedDefaults() {
        const nexusGroups = [
            {
                name: 'System Full Control',
                description: 'Full administrative access to all Nexus modules and settings.',
                permissions: ['all'],
                is_system_default: true,
                scope: 'nexus',
            },
            {
                name: 'Nexus Super Admin',
                description: 'Unlimited access to every Nexus portal module, setting, and platform control.',
                permissions: ['all'],
                is_system_default: true,
                is_template: true,
                scope: 'nexus',
            },
            {
                name: 'Support Operations',
                description: 'Troubleshoot onboarding, support, impersonation, diagnostics, and audit workflows inside Nexus.',
                permissions: [
                    'nexus_clients.client_list.read',
                    'nexus_clients.client_detail.read',
                    'nexus_clients.client_detail.update',
                    'nexus_clients.client_detail.impersonate',
                    'nexus_clients.client_onboarding.create',
                    'nexus_clients.client_onboarding.update',
                    'nexus_users.user_list.read',
                    'nexus_users.user_logs.read',
                    'nexus_users.user_logs.export',
                    'nexus_ops_logs.broadcasts.read',
                    'nexus_ops_logs.audit_logs.read',
                    'nexus_ops_logs.audit_logs.export',
                    'nexus_ops_logs.radar.read',
                ],
                is_system_default: true,
                is_template: true,
                scope: 'nexus',
            },
            {
                name: 'Billing Manager',
                description: 'Manage Nexus subscription plans, invoice operations, and client billing visibility.',
                permissions: [
                    'nexus_finance.invoice_list.read',
                    'nexus_finance.invoice_list.create',
                    'nexus_finance.invoice_list.refund',
                    'nexus_finance.invoice_list.export',
                    'nexus_subscription.sub_plans.read',
                    'nexus_subscription.sub_plans.create',
                    'nexus_subscription.sub_plans.update',
                    'nexus_subscription.sub_plans.delete',
                    'nexus_subscription.addons.read',
                    'nexus_subscription.addons.create',
                    'nexus_subscription.addons.update',
                    'nexus_clients.client_list.read',
                    'nexus_clients.client_detail.read',
                ],
                is_system_default: true,
                is_template: true,
                scope: 'nexus',
            },
        ];

        const templates = DEFAULT_ROLE_TEMPLATES.map((template) => ({
            name: template.name,
            description: template.description,
            permissions: this.normalizePermissions(template.permissions),
            is_system_default: true,
            is_template: true,
            scope: template.templateScope,
        }));

        for (const groupDefinition of [...nexusGroups, ...templates]) {
            const existing = await this.groupRepo.findOne({ where: { name: groupDefinition.name } });
            if (!existing) {
                await this.groupRepo.save(this.groupRepo.create({
                    ...groupDefinition,
                    permissions: this.normalizePermissions((groupDefinition as { permissions?: string[] }).permissions),
                }));
                continue;
            }

            if (existing.is_system_default) {
                existing.permissions = this.normalizePermissions((groupDefinition as { permissions?: string[] }).permissions);
                existing.description = groupDefinition.description;
                existing.scope = groupDefinition.scope;
                const templateFlag = (groupDefinition as { is_template?: boolean }).is_template;
                if (typeof templateFlag === 'boolean') {
                    existing.is_template = templateFlag;
                }
                await this.groupRepo.save(existing);
            }
        }
    }
}
