import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../../auth/request-context.util';
import { buildClientLookupWhere } from '../client-lookup.util';
import { ChartOfAccount } from '../../accounting/entities/chart-of-accounts.entity';
import { Category } from '../../catalog/entities/category.entity';
import { CuisineType } from '../../catalog/entities/cuisine-type.entity';
import { PriceProfile } from '../../catalog/entities/price-profile.entity';
import { Station } from '../../catalog/entities/station.entity';
import { Uom } from '../../catalog/entities/uom.entity';
import { Designation } from '../../setup/entities/Designation.entity';
import { Departments } from '../../setup/entities/Departments.entity';
import { Role } from '../../setup/entities/Roles.entity';
import { OperationalAuditService } from '../audit/operational-audit.service';
import { BlueprintApplicationLog } from '../entities/blueprint-application-log.entity';
import { BlueprintVersion } from '../entities/blueprint-version.entity';
import { Blueprint, BlueprintStatus } from '../entities/blueprint.entity';
import { ClientBlueprintAssignment } from '../entities/client-blueprint-assignment.entity';
import { ClientOnboardingEvent } from '../entities/client-onboarding-event.entity';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { ClientSettings } from '../entities/client-settings.entity';
import { Client } from '../entities/client.entity';
import {
  AssignBlueprintDto,
  BlueprintPayloadDto,
  CreateBlueprintDto,
  CreateBlueprintVersionDto,
  UpdateBlueprintDto,
} from './dto/blueprint.dto';

type SectionResult = {
  status: 'success' | 'skipped';
  message: string;
  details: Record<string, unknown>;
};

@Injectable()
export class BlueprintsService {
  constructor(
    @InjectRepository(Blueprint)
    private readonly blueprintRepository: Repository<Blueprint>,
    @InjectRepository(BlueprintVersion)
    private readonly blueprintVersionRepository: Repository<BlueprintVersion>,
    @InjectRepository(ClientBlueprintAssignment)
    private readonly blueprintAssignmentRepository: Repository<ClientBlueprintAssignment>,
    @InjectRepository(BlueprintApplicationLog)
    private readonly blueprintApplicationLogRepository: Repository<BlueprintApplicationLog>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientOnboarding)
    private readonly onboardingRepository: Repository<ClientOnboarding>,
    @InjectRepository(ClientOnboardingEvent)
    private readonly onboardingEventRepository: Repository<ClientOnboardingEvent>,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listBlueprints(): Promise<any[]> {
    const blueprints = await this.blueprintRepository.find({
      order: { updated_at: 'DESC' },
    });

    if (blueprints.length === 0) {
      return [];
    }

    const blueprintIds = blueprints.map((entry) => entry.id);
    const [versions, assignments] = await Promise.all([
      this.blueprintVersionRepository.find({
        where: blueprintIds.map((blueprintId) => ({ blueprint_id: blueprintId })),
        order: { version_no: 'DESC' },
      }),
      this.blueprintAssignmentRepository.find({
        where: blueprintIds.map((blueprintId) => ({ blueprint_id: blueprintId })),
      }),
    ]);

    const versionMap = new Map<string, BlueprintVersion[]>();
    for (const version of versions) {
      const existing = versionMap.get(version.blueprint_id) || [];
      existing.push(version);
      versionMap.set(version.blueprint_id, existing);
    }

    const assignmentMap = new Map<string, ClientBlueprintAssignment[]>();
    for (const assignment of assignments) {
      const existing = assignmentMap.get(assignment.blueprint_id) || [];
      existing.push(assignment);
      assignmentMap.set(assignment.blueprint_id, existing);
    }

    return blueprints.map((blueprint) => {
      const currentVersions = versionMap.get(blueprint.id) || [];
      const activeVersion = currentVersions.find((version) => version.id === blueprint.active_version_id) || currentVersions[0] || null;
      const currentAssignments = assignmentMap.get(blueprint.id) || [];
      const activePayload = activeVersion ? this.parsePayload(activeVersion.payload_json) : null;

      return {
        ...this.serializeBlueprint(blueprint),
        version_count: currentVersions.length,
        active_version_no: activeVersion?.version_no || null,
        assignment_count: currentAssignments.length,
        applied_count: currentAssignments.filter((entry) => entry.assignment_status === 'applied').length,
        payload_summary: activePayload ? this.summarizePayload(activePayload) : null,
      };
    });
  }

  async getBlueprint(id: string): Promise<any> {
    const blueprint = await this.findBlueprint(id);
    const [versions, assignments, logs] = await Promise.all([
      this.blueprintVersionRepository.find({
        where: { blueprint_id: id },
        order: { version_no: 'DESC' },
      }),
      this.blueprintAssignmentRepository.find({
        where: { blueprint_id: id },
        relations: ['client', 'blueprint_version'],
        order: { created_at: 'DESC', id: 'DESC' },
        take: 20,
      }),
      this.blueprintApplicationLogRepository.find({
        where: { blueprint_id: id },
        order: { created_at: 'DESC', id: 'DESC' },
        take: 50,
      }),
    ]);

    const activeVersion = versions.find((version) => version.id === blueprint.active_version_id) || versions[0] || null;

    return {
      ...this.serializeBlueprint(blueprint),
      active_version: activeVersion ? this.serializeVersion(activeVersion) : null,
      versions: versions.map((version) => this.serializeVersion(version)),
      recent_assignments: assignments.map((assignment) => ({
        id: assignment.id,
        client_id: assignment.client_id,
        client_name: assignment.client?.client_name || assignment.client_id,
        onboarding_id: assignment.onboarding_id,
        blueprint_version_id: assignment.blueprint_version_id,
        version_no: assignment.blueprint_version?.version_no || null,
        assignment_status: assignment.assignment_status,
        applied_at: assignment.applied_at,
        failure_summary: assignment.failure_summary,
        created_at: assignment.created_at,
      })),
      application_history: logs.map((log) => this.serializeApplicationLog(log)),
    };
  }

  async createBlueprint(dto: CreateBlueprintDto, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const blueprintCode = this.normalizeCode(dto.blueprint_code);
    await this.ensureBlueprintCodeAvailable(blueprintCode);
    this.validatePayload(dto.payload);

    const blueprint = await this.blueprintRepository.save(this.blueprintRepository.create({
      blueprint_code: blueprintCode,
      blueprint_name: dto.blueprint_name.trim(),
      description: dto.description?.trim() || null,
      status: dto.status || 'draft',
      created_by: actorId ?? null,
      updated_by: actorId ?? null,
    }));

    const version = await this.blueprintVersionRepository.save(this.blueprintVersionRepository.create({
      blueprint_id: blueprint.id,
      version_no: 1,
      payload_json: JSON.stringify(dto.payload),
      schema_version: 'v2',
      release_notes: dto.release_notes?.trim() || null,
      created_by: actorId ?? null,
    }));

    blueprint.active_version_id = version.id;
    await this.blueprintRepository.save(blueprint);

    await this.operationalAuditService.log({
      user,
      action: 'Create Blueprint',
      entity: 'Blueprint',
      entityId: blueprint.id,
      portal: 'Nexus',
      details: `Created blueprint ${blueprint.blueprint_name}`,
      metadata: { blueprint_code: blueprint.blueprint_code, version_no: 1 },
    });

    return this.getBlueprint(blueprint.id);
  }

  async updateBlueprint(id: string, dto: UpdateBlueprintDto, user?: JwtPayload): Promise<any> {
    const blueprint = await this.findBlueprint(id);
    const previousStatus = blueprint.status;

    if (dto.blueprint_name !== undefined) {
      blueprint.blueprint_name = dto.blueprint_name.trim();
    }
    if (dto.description !== undefined) {
      blueprint.description = dto.description?.trim() || null;
    }
    if (dto.status !== undefined) {
      blueprint.status = dto.status;
    }
    blueprint.updated_by = resolveActorId(user) ?? null;

    await this.blueprintRepository.save(blueprint);
    await this.operationalAuditService.log({
      user,
      action: 'Update Blueprint',
      entity: 'Blueprint',
      entityId: blueprint.id,
      portal: 'Nexus',
      details: `Updated blueprint ${blueprint.blueprint_name}`,
      diff: dto.status !== undefined
        ? [{ field: 'status', oldValue: previousStatus, newValue: dto.status }]
        : undefined,
    });

    return this.getBlueprint(id);
  }

  async updateBlueprintStatus(id: string, status: BlueprintStatus, user?: JwtPayload): Promise<any> {
    const blueprint = await this.findBlueprint(id);
    const previousStatus = blueprint.status;
    blueprint.status = status;
    blueprint.updated_by = resolveActorId(user) ?? null;
    await this.blueprintRepository.save(blueprint);

    await this.operationalAuditService.log({
      user,
      action: 'Update Blueprint Status',
      entity: 'Blueprint',
      entityId: blueprint.id,
      portal: 'Nexus',
      details: `Blueprint ${blueprint.blueprint_name} moved to ${status}`,
      diff: [{ field: 'status', oldValue: previousStatus, newValue: status }],
    });

    return this.getBlueprint(id);
  }

  async createBlueprintVersion(id: string, dto: CreateBlueprintVersionDto, user?: JwtPayload): Promise<any> {
    const blueprint = await this.findBlueprint(id);
    this.validatePayload(dto.payload);

    const latestVersion = await this.blueprintVersionRepository.findOne({
      where: { blueprint_id: id },
      order: { version_no: 'DESC' },
    });

    const version = await this.blueprintVersionRepository.save(this.blueprintVersionRepository.create({
      blueprint_id: id,
      version_no: Number(latestVersion?.version_no || 0) + 1,
      payload_json: JSON.stringify(dto.payload),
      schema_version: 'v2',
      release_notes: dto.release_notes?.trim() || null,
      created_by: resolveActorId(user) ?? null,
    }));

    if (dto.activate) {
      blueprint.active_version_id = version.id;
      await this.blueprintRepository.save(blueprint);
    }

    await this.operationalAuditService.log({
      user,
      action: 'Create Blueprint Version',
      entity: 'BlueprintVersion',
      entityId: version.id,
      portal: 'Nexus',
      details: `Created version ${version.version_no} for ${blueprint.blueprint_name}`,
      metadata: { blueprint_id: blueprint.id, version_no: version.version_no, activated: Boolean(dto.activate) },
    });

    return this.getBlueprint(id);
  }

  async activateBlueprintVersion(id: string, versionId: number, user?: JwtPayload): Promise<any> {
    const blueprint = await this.findBlueprint(id);
    const version = await this.blueprintVersionRepository.findOne({
      where: { id: versionId, blueprint_id: id },
    });
    if (!version) {
      throw new NotFoundException('Blueprint version not found');
    }

    blueprint.active_version_id = version.id;
    blueprint.updated_by = resolveActorId(user) ?? null;
    await this.blueprintRepository.save(blueprint);

    await this.operationalAuditService.log({
      user,
      action: 'Activate Blueprint Version',
      entity: 'BlueprintVersion',
      entityId: version.id,
      portal: 'Nexus',
      details: `Activated blueprint version ${version.version_no}`,
      metadata: { blueprint_id: blueprint.id, version_no: version.version_no },
    });

    return this.getBlueprint(id);
  }

  async getClientBlueprintAssignment(clientId: string): Promise<any> {
    await this.ensureClient(clientId);
    const latestOnboarding = await this.getLatestOnboarding(clientId);
    const assignments = await this.blueprintAssignmentRepository.find({
      where: latestOnboarding
        ? { client_id: clientId, onboarding_id: latestOnboarding.id }
        : { client_id: clientId },
      relations: ['blueprint', 'blueprint_version'],
      order: { created_at: 'DESC', id: 'DESC' },
    });

    return {
      current_assignment: assignments[0] ? this.serializeAssignment(assignments[0]) : null,
      history: assignments.map((assignment) => this.serializeAssignment(assignment)),
    };
  }

  async assignBlueprint(clientId: string, dto: AssignBlueprintDto, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    await this.ensureClient(clientId);
    const onboarding = await this.getRequiredOpenOnboarding(clientId);
    const blueprint = await this.findBlueprint(dto.blueprint_id);
    if (blueprint.status !== 'active') {
      throw new BadRequestException('Only active blueprints can be assigned during onboarding');
    }

    const version = dto.blueprint_version_id
      ? await this.blueprintVersionRepository.findOne({ where: { id: dto.blueprint_version_id, blueprint_id: blueprint.id } })
      : blueprint.active_version_id
        ? await this.blueprintVersionRepository.findOne({ where: { id: blueprint.active_version_id, blueprint_id: blueprint.id } })
        : null;

    if (!version) {
      throw new BadRequestException('No blueprint version is available for assignment');
    }

    const current = await this.blueprintAssignmentRepository.findOne({
      where: { client_id: clientId, onboarding_id: onboarding.id },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    if (
      current &&
      current.blueprint_id === blueprint.id &&
      current.blueprint_version_id === version.id &&
      current.assignment_status === 'assigned'
    ) {
      throw new BadRequestException('This blueprint version is already assigned to the current onboarding workflow');
    }

    const assignment = await this.blueprintAssignmentRepository.save(this.blueprintAssignmentRepository.create({
      client_id: clientId,
      onboarding_id: onboarding.id,
      blueprint_id: blueprint.id,
      blueprint_version_id: version.id,
      assignment_status: 'assigned',
      assigned_by: actorId ?? null,
      failure_summary: null,
    }));

    await this.clientRepository.update(
      buildClientLookupWhere(clientId),
      { onboarding_blueprint: blueprint.blueprint_code } as Partial<Client>,
    );
    await this.logOnboardingEvent(onboarding.id, clientId, 'blueprint_assigned', `Blueprint ${blueprint.blueprint_name} assigned`, actorId, {
      blueprint_id: blueprint.id,
      blueprint_version_id: version.id,
      version_no: version.version_no,
    });

    await this.operationalAuditService.log({
      user,
      action: 'Assign Blueprint',
      entity: 'ClientBlueprintAssignment',
      clientId,
      entityId: assignment.id,
      portal: 'Nexus',
      details: `Assigned blueprint ${blueprint.blueprint_name} to ${clientId}`,
      metadata: { blueprint_id: blueprint.id, blueprint_version_id: version.id, onboarding_id: onboarding.id },
    });

    return this.getClientBlueprintAssignment(clientId);
  }

  async applyBlueprint(clientId: string, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const client = await this.ensureClient(clientId);
    const onboarding = await this.getRequiredOpenOnboarding(clientId);
    const assignment = await this.blueprintAssignmentRepository.findOne({
      where: { client_id: clientId, onboarding_id: onboarding.id },
      relations: ['blueprint', 'blueprint_version'],
      order: { created_at: 'DESC', id: 'DESC' },
    });

    if (!assignment) {
      throw new BadRequestException('Assign a blueprint before applying it');
    }
    if (assignment.assignment_status === 'applied') {
      throw new BadRequestException('The latest assigned blueprint has already been applied');
    }

    const payload = this.parsePayload(assignment.blueprint_version.payload_json);
    this.validatePayload(payload);

    try {
      await this.dataSource.transaction(async (manager) => {
        const sectionEntries = await Promise.all([
          this.buildLogEntry(assignment, onboarding.id, actorId, 'settings', this.applySettingsSection(manager, client, payload.settings)),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'roles', this.applyRolesSection(manager, clientId, payload.roles || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'departments', this.applyDepartmentsSection(manager, clientId, payload.departments || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'designations', this.applyDesignationsSection(manager, clientId, payload.designations || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'chart_of_accounts', this.applyChartOfAccountsSection(manager, clientId, payload.chart_of_accounts || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'categories', this.applyCategoriesSection(manager, clientId, payload.categories || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'price_profiles', this.applyPriceProfilesSection(manager, clientId, payload.price_profiles || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'cuisine_types', this.applyCuisineTypesSection(manager, clientId, payload.cuisine_types || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'stations', this.applyStationsSection(manager, clientId, payload.stations || [])),
          this.buildLogEntry(assignment, onboarding.id, actorId, 'uoms', this.applyUomsSection(manager, clientId, payload.uoms || [])),
        ]);

        assignment.assignment_status = 'applied';
        assignment.applied_by = actorId ?? null;
        assignment.applied_at = new Date();
        assignment.failure_summary = null;
        await manager.save(ClientBlueprintAssignment, assignment);
        await manager.save(BlueprintApplicationLog, sectionEntries.map((entry) => manager.create(BlueprintApplicationLog, entry)));

        await manager.save(ClientOnboardingEvent, manager.create(ClientOnboardingEvent, {
          onboarding_id: onboarding.id,
          client_id: clientId,
          event_type: 'blueprint_applied',
          step_key: 'blueprint_applied',
          message: `Blueprint ${assignment.blueprint.blueprint_name} applied`,
          details_json: JSON.stringify({
            blueprint_id: assignment.blueprint_id,
            blueprint_version_id: assignment.blueprint_version_id,
            version_no: assignment.blueprint_version.version_no,
            sections: sectionEntries.map((entry) => ({
              section_key: entry.section_key,
              result_status: entry.result_status,
            })),
          }),
          created_by: actorId ?? null,
        }));
      });
    } catch (error) {
      assignment.assignment_status = 'failed';
      assignment.failure_summary = error instanceof Error ? error.message : 'Blueprint application failed';
      assignment.applied_by = null;
      assignment.applied_at = null;
      await this.blueprintAssignmentRepository.save(assignment);

      await this.blueprintApplicationLogRepository.save(this.blueprintApplicationLogRepository.create({
        assignment_id: assignment.id,
        client_id: clientId,
        onboarding_id: onboarding.id,
        blueprint_id: assignment.blueprint_id,
        blueprint_version_id: assignment.blueprint_version_id,
        section_key: 'application',
        result_status: 'failed',
        message: assignment.failure_summary,
        details_json: null,
        executed_by: actorId ?? null,
      }));

      await this.logOnboardingEvent(onboarding.id, clientId, 'blueprint_failed', assignment.failure_summary, actorId, {
        blueprint_id: assignment.blueprint_id,
        blueprint_version_id: assignment.blueprint_version_id,
      });

      throw error;
    }

    await this.operationalAuditService.log({
      user,
      action: 'Apply Blueprint',
      entity: 'ClientBlueprintAssignment',
      clientId,
      entityId: assignment.id,
      portal: 'Nexus',
      details: `Applied blueprint ${assignment.blueprint.blueprint_name} to ${client.client_name}`,
      metadata: { blueprint_id: assignment.blueprint_id, blueprint_version_id: assignment.blueprint_version_id },
    });

    return this.getClientBlueprintAssignment(clientId);
  }

  async getClientBlueprintHistory(clientId: string): Promise<any[]> {
    await this.ensureClient(clientId);
    const assignments = await this.blueprintAssignmentRepository.find({
      where: { client_id: clientId },
      relations: ['blueprint', 'blueprint_version'],
      order: { created_at: 'DESC', id: 'DESC' },
    });

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const logs = assignmentIds.length
      ? await this.blueprintApplicationLogRepository.find({
          where: assignmentIds.map((assignmentId) => ({ assignment_id: assignmentId })),
          order: { created_at: 'DESC', id: 'DESC' },
        })
      : [];

    const logMap = new Map<number, BlueprintApplicationLog[]>();
    for (const log of logs) {
      const existing = logMap.get(log.assignment_id) || [];
      existing.push(log);
      logMap.set(log.assignment_id, existing);
    }

    return assignments.map((assignment) => ({
      ...this.serializeAssignment(assignment),
      logs: (logMap.get(assignment.id) || []).map((log) => this.serializeApplicationLog(log)),
    }));
  }

  private async buildLogEntry(
    assignment: ClientBlueprintAssignment,
    onboardingId: number,
    actorId: string | undefined,
    sectionKey: string,
    promise: Promise<SectionResult>,
  ): Promise<Partial<BlueprintApplicationLog>> {
    const result = await promise;
    return {
      assignment_id: assignment.id,
      client_id: assignment.client_id,
      onboarding_id: onboardingId,
      blueprint_id: assignment.blueprint_id,
      blueprint_version_id: assignment.blueprint_version_id,
      section_key: sectionKey,
      result_status: result.status,
      message: result.message,
      details_json: JSON.stringify(result.details),
      executed_by: actorId ?? null,
    };
  }

  private async applySettingsSection(
    manager: EntityManager,
    client: Client,
    settings?: BlueprintPayloadDto['settings'],
  ): Promise<SectionResult> {
    if (!settings) {
      return { status: 'skipped', message: 'No client settings preset in blueprint', details: {} };
    }

    let clientSettings = await manager.findOne(ClientSettings, { where: { client_id: client.client_code } });
    if (!clientSettings) {
      clientSettings = manager.create(ClientSettings, {
        client_id: client.client_code,
        currency: settings.currency || client.currency || 'USD',
        timezone: settings.timezone || client.timezone || 'UTC',
        fiscal_year_start: settings.fiscal_year_start || 1,
        contact_email: settings.contact_email || client.email || undefined,
        contact_phone: settings.contact_phone || client.phone || undefined,
        address: settings.address || client.address || undefined,
      });
      await manager.save(ClientSettings, clientSettings);
      return {
        status: 'success',
        message: 'Client settings created from blueprint defaults',
        details: { mode: 'created' },
      };
    }

    const changes: Record<string, unknown> = {};
    const applyIfEmpty = <K extends keyof ClientSettings>(field: K, value: ClientSettings[K] | undefined) => {
      const current = clientSettings![field];
      if ((current === null || current === undefined || current === '') && value !== undefined && value !== null && value !== '') {
        clientSettings![field] = value as ClientSettings[K];
        changes[String(field)] = value;
      }
    };

    applyIfEmpty('currency', settings.currency || undefined);
    applyIfEmpty('timezone', settings.timezone || undefined);
    applyIfEmpty('fiscal_year_start', settings.fiscal_year_start || undefined);
    applyIfEmpty('contact_email', settings.contact_email || undefined);
    applyIfEmpty('contact_phone', settings.contact_phone || undefined);
    applyIfEmpty('address', settings.address || undefined);

    if (Object.keys(changes).length > 0) {
      await manager.save(ClientSettings, clientSettings);
      return {
        status: 'success',
        message: 'Empty client setting fields were initialized from blueprint defaults',
        details: changes,
      };
    }

    return {
      status: 'skipped',
      message: 'Client settings already contained values; blueprint did not overwrite them',
      details: {},
    };
  }

  private async applyRolesSection(
    manager: EntityManager,
    clientId: string,
    roles: NonNullable<BlueprintPayloadDto['roles']>,
  ): Promise<SectionResult> {
    if (roles.length === 0) {
      return { status: 'skipped', message: 'No role skeletons present in blueprint', details: {} };
    }

    const existingRoles = await manager.find(Role, { where: { client_id: clientId } });
    const existingNames = new Set(existingRoles.map((role) => this.normalizeLookupKey(role.role_name)));
    let createdCount = 0;
    const skippedNames: string[] = [];

    for (const roleTemplate of roles) {
      const normalizedName = this.normalizeLookupKey(roleTemplate.role_name);
      if (existingNames.has(normalizedName)) {
        skippedNames.push(roleTemplate.role_name);
        continue;
      }

      await manager.save(Role, manager.create(Role, {
        client_id: clientId,
        role_name: roleTemplate.role_name.trim(),
        permissions: [...new Set(roleTemplate.permissions || [])],
        is_system_role: Boolean(roleTemplate.is_system_role),
        is_active: roleTemplate.is_active ?? true,
        description: roleTemplate.description?.trim() || null,
        context_scope: roleTemplate.context_scope ?? 'hybrid',
        approval_authority: roleTemplate.approval_authority ?? 'none',
      }));
      existingNames.add(normalizedName);
      createdCount += 1;
    }

    if (createdCount === 0) {
      return {
        status: 'skipped',
        message: 'All blueprint roles already existed for this client',
        details: { skipped_roles: skippedNames },
      };
    }

    return {
      status: 'success',
      message: 'Role skeletons created from blueprint',
      details: { created_count: createdCount, skipped_roles: skippedNames },
    };
  }

  private async applyDepartmentsSection(
    manager: EntityManager,
    clientId: string,
    departments: NonNullable<BlueprintPayloadDto['departments']>,
  ): Promise<SectionResult> {
    if (departments.length === 0) {
      return { status: 'skipped', message: 'No department templates present in blueprint', details: {} };
    }

    const existing = await manager.find(Departments, { where: { clientId } });
    const existingCodes = new Set(existing.map((row) => this.normalizeLookupKey(row.code)));
    const existingNames = new Set(existing.map((row) => this.normalizeLookupKey(row.name)));
    let createdCount = 0;
    const skipped: string[] = [];

    for (const template of departments) {
      const codeKey = this.normalizeLookupKey(template.code);
      const nameKey = this.normalizeLookupKey(template.name);
      if (existingCodes.has(codeKey) || existingNames.has(nameKey)) {
        skipped.push(template.code);
        continue;
      }

      await manager.save(Departments, manager.create(Departments, {
        clientId,
        code: template.code.trim(),
        name: template.name.trim(),
        description: template.description?.trim() || null,
        headName: template.head_name?.trim() || null,
        isActive: template.is_active ?? true,
        branchAvailability: template.branch_availability ?? null,
      } as Partial<Departments>));
      existingCodes.add(codeKey);
      existingNames.add(nameKey);
      createdCount += 1;
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint departments already existed for this client', details: { skipped_codes: skipped } }
      : { status: 'success', message: 'Departments created from blueprint', details: { created_count: createdCount, skipped_codes: skipped } };
  }

  private async applyDesignationsSection(
    manager: EntityManager,
    clientId: string,
    designations: NonNullable<BlueprintPayloadDto['designations']>,
  ): Promise<SectionResult> {
    if (designations.length === 0) {
      return { status: 'skipped', message: 'No designation templates present in blueprint', details: {} };
    }

    const existing = await manager.find(Designation, { where: { clientId } });
    const existingCodes = new Set(existing.map((row) => this.normalizeLookupKey(row.code)));
    const existingNames = new Set(existing.map((row) => this.normalizeLookupKey(row.name)));
    let createdCount = 0;
    const skipped: string[] = [];

    for (const template of designations) {
      const codeKey = this.normalizeLookupKey(template.code);
      const nameKey = this.normalizeLookupKey(template.name);
      if (existingCodes.has(codeKey) || existingNames.has(nameKey)) {
        skipped.push(template.code);
        continue;
      }

      await manager.save(Designation, manager.create(Designation, {
        clientId,
        code: template.code.trim(),
        name: template.name.trim(),
        level: template.level?.trim() || null,
        departmentName: template.department_name?.trim() || null,
        description: template.description?.trim() || null,
        isActive: template.is_active ?? true,
        branchAvailability: template.branch_availability ?? null,
      } as Partial<Designation>));
      existingCodes.add(codeKey);
      existingNames.add(nameKey);
      createdCount += 1;
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint designations already existed for this client', details: { skipped_codes: skipped } }
      : { status: 'success', message: 'Designations created from blueprint', details: { created_count: createdCount, skipped_codes: skipped } };
  }

  private async applyChartOfAccountsSection(
    manager: EntityManager,
    clientId: string,
    accounts: NonNullable<BlueprintPayloadDto['chart_of_accounts']>,
  ): Promise<SectionResult> {
    if (accounts.length === 0) {
      return { status: 'skipped', message: 'No chart of account templates present in blueprint', details: {} };
    }

    const existing = await manager.find(ChartOfAccount, {
      where: { client_id: clientId },
      order: { account_code: 'ASC' },
    });
    const existingByCode = new Map(existing.map((row) => [this.normalizeLookupKey(row.account_code), row]));
    const pending = [...accounts];
    const skippedCodes: string[] = [];
    let createdCount = 0;
    let progressed = true;

    while (pending.length > 0 && progressed) {
      progressed = false;

      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const template = pending[index];
        const codeKey = this.normalizeLookupKey(template.account_code);
        if (existingByCode.has(codeKey)) {
          skippedCodes.push(template.account_code);
          pending.splice(index, 1);
          progressed = true;
          continue;
        }

        const parentKey = template.parent_code ? this.normalizeLookupKey(template.parent_code) : null;
        const parent = parentKey ? existingByCode.get(parentKey) : null;
        if (parentKey && !parent) {
          continue;
        }

        const saved = await manager.save(ChartOfAccount, manager.create(ChartOfAccount, {
          client_id: clientId,
          account_code: template.account_code.trim(),
          account_name: template.account_name.trim(),
          account_type: template.account_type,
          parent_id: parent?.id ?? null,
          branch_id: null,
          scope: 'company',
          is_active: template.is_active ?? true,
        }));
        existingByCode.set(codeKey, saved);
        pending.splice(index, 1);
        createdCount += 1;
        progressed = true;
      }
    }

    if (pending.length > 0) {
      throw new BadRequestException(`Unresolved chart of account parent references: ${pending.map((item) => item.account_code).join(', ')}`);
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint accounts already existed for this client', details: { skipped_codes: skippedCodes } }
      : { status: 'success', message: 'Chart of accounts initialized from blueprint', details: { created_count: createdCount, skipped_codes: skippedCodes } };
  }

  private async applyCategoriesSection(
    manager: EntityManager,
    clientId: string,
    categories: NonNullable<BlueprintPayloadDto['categories']>,
  ): Promise<SectionResult> {
    if (categories.length === 0) {
      return { status: 'skipped', message: 'No category templates present in blueprint', details: {} };
    }

    const existing = await manager.find(Category, { where: { client_id: clientId } });
    const existingByName = new Map(existing.map((row) => [this.normalizeLookupKey(row.category_name), row]));
    const refs = new Map<string, Category>();
    for (const row of existing) {
      refs.set(this.normalizeLookupKey(row.category_name), row);
    }

    const pending = [...categories];
    const skippedNames: string[] = [];
    let createdCount = 0;
    let progressed = true;

    while (pending.length > 0 && progressed) {
      progressed = false;

      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const template = pending[index];
        const nameKey = this.normalizeLookupKey(template.category_name);
        const refKey = this.normalizeLookupKey(template.template_key || template.category_name);
        const parentKey = template.parent_template_key ? this.normalizeLookupKey(template.parent_template_key) : null;
        const parent = parentKey ? refs.get(parentKey) : null;

        if (parentKey && !parent) {
          continue;
        }

        const existingCategory = existingByName.get(nameKey);
        if (existingCategory) {
          refs.set(refKey, existingCategory);
          refs.set(nameKey, existingCategory);
          skippedNames.push(template.category_name);
          pending.splice(index, 1);
          progressed = true;
          continue;
        }

        const saved = await manager.save(Category, manager.create(Category, {
          client_id: clientId,
          category_name: template.category_name.trim(),
          category_description: template.category_description?.trim() || null,
          category_sort_order: template.category_sort_order ?? 0,
          parent_category_id: parent?.id ?? null,
          branchAvailability: template.branch_availability ?? null,
          is_active: template.is_active ?? true,
        } as Partial<Category>));
        existingByName.set(nameKey, saved);
        refs.set(refKey, saved);
        refs.set(nameKey, saved);
        pending.splice(index, 1);
        createdCount += 1;
        progressed = true;
      }
    }

    if (pending.length > 0) {
      throw new BadRequestException(`Unresolved category parent references: ${pending.map((item) => item.category_name).join(', ')}`);
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint categories already existed for this client', details: { skipped_names: skippedNames } }
      : { status: 'success', message: 'Categories created from blueprint', details: { created_count: createdCount, skipped_names: skippedNames } };
  }

  private async applyPriceProfilesSection(
    manager: EntityManager,
    clientId: string,
    menuTypes: NonNullable<BlueprintPayloadDto['price_profiles']>,
  ): Promise<SectionResult> {
    if (menuTypes.length === 0) {
      return { status: 'skipped', message: 'No menu type templates present in blueprint', details: {} };
    }

    const existing = await manager.find(PriceProfile, { where: { client_id: clientId } });
    const existingKeys = new Set(existing.flatMap((row) => [this.normalizeLookupKey(row.name), this.normalizeLookupKey(row.code || '')].filter(Boolean)));
    let createdCount = 0;
    const skipped: string[] = [];

    for (const template of menuTypes) {
      const lookupKey = this.normalizeLookupKey(template.code || template.name);
      if (existingKeys.has(lookupKey)) {
        skipped.push(template.code || template.name);
        continue;
      }

      await manager.save(PriceProfile, manager.create(PriceProfile, {
        client_id: clientId,
        name: template.name.trim(),
        code: template.code?.trim() || null,
        description: template.description?.trim() || null,
        is_active: template.is_active ?? true,
        sort_order: template.sort_order ?? 0,
        branchAvailability: template.branch_availability ?? null,
      } as Partial<PriceProfile>));
      existingKeys.add(lookupKey);
      existingKeys.add(this.normalizeLookupKey(template.name));
      createdCount += 1;
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint menu types already existed for this client', details: { skipped_values: skipped } }
      : { status: 'success', message: 'Menu types created from blueprint', details: { created_count: createdCount, skipped_values: skipped } };
  }

  private async applyCuisineTypesSection(
    manager: EntityManager,
    clientId: string,
    cuisineTypes: NonNullable<BlueprintPayloadDto['cuisine_types']>,
  ): Promise<SectionResult> {
    if (cuisineTypes.length === 0) {
      return { status: 'skipped', message: 'No cuisine type templates present in blueprint', details: {} };
    }

    const existing = await manager.find(CuisineType, { where: { client_id: clientId } });
    const existingKeys = new Set(existing.flatMap((row) => [this.normalizeLookupKey(row.name), this.normalizeLookupKey(row.code || '')].filter(Boolean)));
    let createdCount = 0;
    const skipped: string[] = [];

    for (const template of cuisineTypes) {
      const lookupKey = this.normalizeLookupKey(template.code || template.name);
      if (existingKeys.has(lookupKey)) {
        skipped.push(template.code || template.name);
        continue;
      }

      await manager.save(CuisineType, manager.create(CuisineType, {
        client_id: clientId,
        name: template.name.trim(),
        code: template.code?.trim() || null,
        description: template.description?.trim() || null,
        is_active: template.is_active ?? true,
        sort_order: template.sort_order ?? 0,
        branchAvailability: template.branch_availability ?? null,
      } as Partial<CuisineType>));
      existingKeys.add(lookupKey);
      existingKeys.add(this.normalizeLookupKey(template.name));
      createdCount += 1;
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint cuisine types already existed for this client', details: { skipped_values: skipped } }
      : { status: 'success', message: 'Cuisine types created from blueprint', details: { created_count: createdCount, skipped_values: skipped } };
  }

  private async applyStationsSection(
    manager: EntityManager,
    clientId: string,
    stations: NonNullable<BlueprintPayloadDto['stations']>,
  ): Promise<SectionResult> {
    if (stations.length === 0) {
      return { status: 'skipped', message: 'No station templates present in blueprint', details: {} };
    }

    const existing = await manager.find(Station, { where: { client_id: clientId } });
    const existingKeys = new Set(existing.flatMap((row) => [this.normalizeLookupKey(row.name), this.normalizeLookupKey(row.code || '')].filter(Boolean)));
    let createdCount = 0;
    const skipped: string[] = [];

    for (const template of stations) {
      const lookupKey = this.normalizeLookupKey(template.code || template.name);
      if (existingKeys.has(lookupKey)) {
        skipped.push(template.code || template.name);
        continue;
      }

      await manager.save(Station, manager.create(Station, {
        client_id: clientId,
        name: template.name.trim(),
        code: template.code?.trim() || null,
        description: template.description?.trim() || null,
        is_active: template.is_active ?? true,
        supports_hot_food: template.supports_hot_food ?? false,
        supports_cold_food: template.supports_cold_food ?? false,
        kitchen_display_order: template.kitchen_display_order ?? 0,
        branchAvailability: template.branch_availability ?? null,
      } as Partial<Station>));
      existingKeys.add(lookupKey);
      existingKeys.add(this.normalizeLookupKey(template.name));
      createdCount += 1;
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint stations already existed for this client', details: { skipped_values: skipped } }
      : { status: 'success', message: 'Stations created from blueprint', details: { created_count: createdCount, skipped_values: skipped } };
  }

  private async applyUomsSection(
    manager: EntityManager,
    clientId: string,
    uoms: NonNullable<BlueprintPayloadDto['uoms']>,
  ): Promise<SectionResult> {
    if (uoms.length === 0) {
      return { status: 'skipped', message: 'No UOM templates present in blueprint', details: {} };
    }

    const existing = await manager.find(Uom, { where: { client_id: clientId } });
    const refs = new Map<string, Uom>();
    const existingByAbbreviation = new Map<string, Uom>();
    for (const row of existing) {
      const abbreviationKey = this.normalizeLookupKey(row.abbreviation);
      const nameKey = this.normalizeLookupKey(row.name);
      existingByAbbreviation.set(abbreviationKey, row);
      refs.set(abbreviationKey, row);
      refs.set(nameKey, row);
    }

    const pending = [...uoms];
    const skipped: string[] = [];
    let createdCount = 0;
    let progressed = true;

    while (pending.length > 0 && progressed) {
      progressed = false;

      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const template = pending[index];
        const abbreviationKey = this.normalizeLookupKey(template.abbreviation);
        const refKey = this.normalizeLookupKey(template.template_key || template.abbreviation);
        const baseKey = template.base_template_key ? this.normalizeLookupKey(template.base_template_key) : null;
        const baseUnit = baseKey ? refs.get(baseKey) : null;

        if (baseKey && !baseUnit) {
          continue;
        }

        const existingUom = existingByAbbreviation.get(abbreviationKey);
        if (existingUom) {
          refs.set(refKey, existingUom);
          refs.set(abbreviationKey, existingUom);
          refs.set(this.normalizeLookupKey(template.name), existingUom);
          skipped.push(template.abbreviation);
          pending.splice(index, 1);
          progressed = true;
          continue;
        }

        const saved = await manager.save(Uom, manager.create(Uom, {
          client_id: clientId,
          name: template.name.trim(),
          abbreviation: template.abbreviation.trim(),
          description: template.description?.trim() || null,
          is_base_unit: template.is_base_unit ?? !baseUnit,
          is_active: template.is_active ?? true,
          base_unit_id: baseUnit?.id ?? null,
          conversion_factor: template.conversion_factor ?? null,
          branchAvailability: template.branch_availability ?? null,
        } as Partial<Uom>));
        existingByAbbreviation.set(abbreviationKey, saved);
        refs.set(refKey, saved);
        refs.set(abbreviationKey, saved);
        refs.set(this.normalizeLookupKey(template.name), saved);
        pending.splice(index, 1);
        createdCount += 1;
        progressed = true;
      }
    }

    if (pending.length > 0) {
      throw new BadRequestException(`Unresolved UOM base references: ${pending.map((item) => item.abbreviation).join(', ')}`);
    }

    return createdCount === 0
      ? { status: 'skipped', message: 'All blueprint UOMs already existed for this client', details: { skipped_values: skipped } }
      : { status: 'success', message: 'UOMs created from blueprint', details: { created_count: createdCount, skipped_values: skipped } };
  }

  private async findBlueprint(id: string): Promise<Blueprint> {
    const blueprint = await this.blueprintRepository.findOne({ where: { id } });
    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }
    return blueprint;
  }

  private async ensureClient(clientId: string): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: buildClientLookupWhere(clientId) });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  private async getLatestOnboarding(clientId: string): Promise<ClientOnboarding | null> {
    return this.onboardingRepository.findOne({
      where: { client_id: clientId },
      order: { created_at: 'DESC', id: 'DESC' },
    });
  }

  private async getRequiredOpenOnboarding(clientId: string): Promise<ClientOnboarding> {
    const onboarding = await this.getLatestOnboarding(clientId);
    if (!onboarding) {
      throw new BadRequestException('Onboarding must be started before assigning a blueprint');
    }
    if (['completed', 'cancelled'].includes(onboarding.status)) {
      throw new BadRequestException('Blueprint changes are not allowed on a completed onboarding workflow');
    }
    return onboarding;
  }

  private async ensureBlueprintCodeAvailable(code: string): Promise<void> {
    const existing = await this.blueprintRepository.findOne({ where: { blueprint_code: code } });
    if (existing) {
      throw new BadRequestException('Blueprint code already exists');
    }
  }

  private normalizeCode(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '-');
  }

  private normalizeLookupKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private parsePayload(payloadJson: string): BlueprintPayloadDto {
    try {
      return JSON.parse(payloadJson);
    } catch {
      throw new BadRequestException('Blueprint payload is not valid JSON');
    }
  }

  private validatePayload(payload: BlueprintPayloadDto): void {
    const keys = Object.keys(payload || {});
    const allowedKeys = ['settings', 'roles', 'departments', 'designations', 'chart_of_accounts', 'categories', 'price_profiles', 'cuisine_types', 'stations', 'uoms'];
    const invalidKeys = keys.filter((key) => !allowedKeys.includes(key));
    if (invalidKeys.length > 0) {
      throw new BadRequestException(`Unsupported blueprint sections: ${invalidKeys.join(', ')}`);
    }

    const hasSupportedContent = Boolean(
      payload?.settings
      || payload?.roles?.length
      || payload?.departments?.length
      || payload?.designations?.length
      || payload?.chart_of_accounts?.length
      || payload?.categories?.length
      || payload?.price_profiles?.length
      || payload?.cuisine_types?.length
      || payload?.stations?.length
      || payload?.uoms?.length,
    );
    if (!hasSupportedContent) {
      throw new BadRequestException('Blueprint payload must include at least one safe configuration section');
    }

    this.ensureUniqueNames('role template', payload.roles?.map((role) => role.role_name));
    this.ensureUniqueNames('department code', payload.departments?.map((item) => item.code));
    this.ensureUniqueNames('designation code', payload.designations?.map((item) => item.code));
    this.ensureUniqueNames('account code', payload.chart_of_accounts?.map((item) => item.account_code));
    this.ensureUniqueNames('category name', payload.categories?.map((item) => item.category_name));
    this.ensureUniqueNames('menu type', payload.price_profiles?.map((item) => item.code || item.name));
    this.ensureUniqueNames('cuisine type', payload.cuisine_types?.map((item) => item.code || item.name));
    this.ensureUniqueNames('station', payload.stations?.map((item) => item.code || item.name));
    this.ensureUniqueNames('uom', payload.uoms?.map((item) => item.abbreviation));
    this.ensureUniqueNames('category template key', payload.categories?.map((item) => item.template_key).filter(Boolean));
    this.ensureUniqueNames('uom template key', payload.uoms?.map((item) => item.template_key).filter(Boolean));

    for (const account of payload.chart_of_accounts || []) {
      if (account.parent_code && this.normalizeLookupKey(account.parent_code) === this.normalizeLookupKey(account.account_code)) {
        throw new BadRequestException(`Account ${account.account_code} cannot reference itself as parent`);
      }
    }
    for (const category of payload.categories || []) {
      if (category.template_key && category.parent_template_key && this.normalizeLookupKey(category.template_key) === this.normalizeLookupKey(category.parent_template_key)) {
        throw new BadRequestException(`Category ${category.category_name} cannot reference itself as parent`);
      }
    }
    for (const uom of payload.uoms || []) {
      if (uom.template_key && uom.base_template_key && this.normalizeLookupKey(uom.template_key) === this.normalizeLookupKey(uom.base_template_key)) {
        throw new BadRequestException(`UOM ${uom.abbreviation} cannot reference itself as base unit`);
      }
    }
  }

  private ensureUniqueNames(section: string, values?: Array<string | undefined>): void {
    const seen = new Set<string>();
    for (const value of values || []) {
      if (!value) {
        continue;
      }
      const normalized = this.normalizeLookupKey(value);
      if (seen.has(normalized)) {
        throw new BadRequestException(`Duplicate ${section}: ${value}`);
      }
      seen.add(normalized);
    }
  }

  private async logOnboardingEvent(
    onboardingId: number,
    clientId: string,
    eventType: string,
    message: string,
    actorId?: string,
    details?: Record<string, unknown>,
  ) {
    await this.onboardingEventRepository.save(this.onboardingEventRepository.create({
      onboarding_id: onboardingId,
      client_id: clientId,
      event_type: eventType,
      step_key: 'blueprint_applied',
      message,
      details_json: details ? JSON.stringify(details) : null,
      created_by: actorId ?? null,
    }));
  }

  private summarizePayload(payload: BlueprintPayloadDto) {
    return {
      settings: payload.settings ? 1 : 0,
      roles: payload.roles?.length || 0,
      departments: payload.departments?.length || 0,
      designations: payload.designations?.length || 0,
      chart_of_accounts: payload.chart_of_accounts?.length || 0,
      categories: payload.categories?.length || 0,
      price_profiles: payload.price_profiles?.length || 0,
      cuisine_types: payload.cuisine_types?.length || 0,
      stations: payload.stations?.length || 0,
      uoms: payload.uoms?.length || 0,
    };
  }

  private serializeBlueprint(blueprint: Blueprint) {
    return {
      id: blueprint.id,
      blueprint_code: blueprint.blueprint_code,
      blueprint_name: blueprint.blueprint_name,
      description: blueprint.description,
      status: blueprint.status,
      active_version_id: blueprint.active_version_id,
      created_at: blueprint.created_at,
      updated_at: blueprint.updated_at,
    };
  }

  private serializeVersion(version: BlueprintVersion) {
    const payload = this.parsePayload(version.payload_json);
    return {
      id: version.id,
      blueprint_id: version.blueprint_id,
      version_no: version.version_no,
      schema_version: version.schema_version,
      release_notes: version.release_notes,
      payload,
      payload_summary: this.summarizePayload(payload),
      created_at: version.created_at,
    };
  }

  private serializeAssignment(assignment: ClientBlueprintAssignment) {
    return {
      id: assignment.id,
      client_id: assignment.client_id,
      onboarding_id: assignment.onboarding_id,
      blueprint_id: assignment.blueprint_id,
      blueprint_name: assignment.blueprint?.blueprint_name || null,
      blueprint_code: assignment.blueprint?.blueprint_code || null,
      blueprint_version_id: assignment.blueprint_version_id,
      version_no: assignment.blueprint_version?.version_no || null,
      assignment_status: assignment.assignment_status,
      applied_by: assignment.applied_by,
      applied_at: assignment.applied_at,
      failure_summary: assignment.failure_summary,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
    };
  }

  private serializeApplicationLog(log: BlueprintApplicationLog) {
    return {
      id: log.id,
      assignment_id: log.assignment_id,
      section_key: log.section_key,
      result_status: log.result_status,
      message: log.message,
      details: log.details_json ? JSON.parse(log.details_json) : null,
      executed_by: log.executed_by,
      created_at: log.created_at,
    };
  }
}
