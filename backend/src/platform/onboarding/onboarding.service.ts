import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../../auth/request-context.util';
import { buildClientLookupWhere } from '../client-lookup.util';
import { Role } from '../../setup/entities/Roles.entity';
import { RolesService } from '../../setup/roles/roles.service';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { UserManagementsService } from '../../setup/users/users.service';
import { OperationalAuditService } from '../audit/operational-audit.service';
import { ClientContact } from '../entities/client-contact.entity';
import { ClientLimitOverride } from '../entities/client-limit-override.entity';
import { Blueprint } from '../entities/blueprint.entity';
import { BlueprintVersion } from '../entities/blueprint-version.entity';
import { ClientBlueprintAssignment } from '../entities/client-blueprint-assignment.entity';
import { ClientOnboarding, ClientOnboardingStatus } from '../entities/client-onboarding.entity';
import { ClientOnboardingEvent } from '../entities/client-onboarding-event.entity';
import {
  ClientOnboardingStep,
  ClientOnboardingStepStatus,
  ClientOnboardingStepType,
} from '../entities/client-onboarding-step.entity';
import { ClientStatusHistory } from '../entities/client-status-history.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { Client } from '../entities/client.entity';
import { CreateInitialAdminDto, UpdateOnboardingStepDto } from './dto/onboarding.dto';

type StepKey =
  | 'registry_verified'
  | 'subscription_verified'
  | 'blueprint_applied'
  | 'initial_admin_created'
  | 'minimum_setup_confirmed'
  | 'readiness_review'
  | 'client_activated';

interface StepDefinition {
  key: StepKey;
  name: string;
  type: ClientOnboardingStepType;
  required: boolean;
  sortOrder: number;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  { key: 'registry_verified', name: 'Registry Verified', type: 'system', required: true, sortOrder: 1 },
  { key: 'subscription_verified', name: 'Commercial Subscription Verified', type: 'system', required: true, sortOrder: 2 },
  { key: 'blueprint_applied', name: 'Blueprint Applied', type: 'action', required: true, sortOrder: 3 },
  { key: 'initial_admin_created', name: 'Initial Admin Created', type: 'action', required: true, sortOrder: 4 },
  { key: 'minimum_setup_confirmed', name: 'Minimum Setup Confirmed', type: 'manual', required: true, sortOrder: 5 },
  { key: 'readiness_review', name: 'Readiness Review Approved', type: 'manual', required: true, sortOrder: 6 },
  { key: 'client_activated', name: 'Client Activated', type: 'system', required: true, sortOrder: 7 },
];

const OPEN_ONBOARDING_STATUSES: ClientOnboardingStatus[] = [
  'in_progress',
  'blocked',
  'failed',
  'ready_for_activation',
];

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientContact)
    private readonly contactRepository: Repository<ClientContact>,
    @InjectRepository(ClientSubscription)
    private readonly subscriptionRepository: Repository<ClientSubscription>,
    @InjectRepository(ClientOnboarding)
    private readonly onboardingRepository: Repository<ClientOnboarding>,
    @InjectRepository(ClientOnboardingStep)
    private readonly onboardingStepRepository: Repository<ClientOnboardingStep>,
    @InjectRepository(ClientOnboardingEvent)
    private readonly onboardingEventRepository: Repository<ClientOnboardingEvent>,
    @InjectRepository(ClientBlueprintAssignment)
    private readonly clientBlueprintAssignmentRepository: Repository<ClientBlueprintAssignment>,
    @InjectRepository(Blueprint)
    private readonly blueprintRepository: Repository<Blueprint>,
    @InjectRepository(BlueprintVersion)
    private readonly blueprintVersionRepository: Repository<BlueprintVersion>,
    @InjectRepository(ClientStatusHistory)
    private readonly statusHistoryRepository: Repository<ClientStatusHistory>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserManagement)
    private readonly userRepository: Repository<UserManagement>,
    @InjectRepository(ClientLimitOverride)
    private readonly clientLimitOverrideRepository: Repository<ClientLimitOverride>,
    private readonly rolesService: RolesService,
    private readonly usersService: UserManagementsService,
    private readonly operationalAuditService: OperationalAuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listQueue(): Promise<any[]> {
    const clients = await this.clientRepository.find({
      where: [
        { status: 'draft' as any },
        { status: 'onboarding' as any },
      ],
      order: { updated_at: 'DESC' },
    });

    const queue: any[] = [];
    for (const client of clients) {
      const detail = await this.getClientOnboarding(client.client_code);
      queue.push({
        client_id: client.id,
        client_code: client.client_code,
        client_name: client.client_name,
        client_status: client.status,
        onboarding_status: detail.onboarding?.status || 'not_started',
        current_stage: detail.onboarding?.current_stage || null,
        started_at: detail.onboarding?.started_at || null,
        current_plan_name: detail.current_subscription?.plan_name || null,
        subscription_status: detail.current_subscription?.status || null,
        can_start: !detail.onboarding,
        can_activate: detail.readiness?.can_activate || false,
        blockers: detail.readiness?.blockers || [],
      });
    }

    return queue;
  }

  async getClientOnboarding(clientId: string): Promise<any> {
    const client = await this.clientRepository.findOne({ where: buildClientLookupWhere(clientId) });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    const clientCode = client.client_code;

    const onboarding = await this.getLatestOnboarding(clientCode);
    const currentSubscription = await this.getCurrentSubscription(clientCode);

    if (!onboarding) {
      const initialAdmin = await this.resolvePreferredClientAdmin(clientCode);
      return {
        client: this.serializeClient(client),
        current_subscription: currentSubscription ? this.serializeSubscription(currentSubscription) : null,
        onboarding: null,
        steps: STEP_DEFINITIONS.map((definition) => ({
          step_key: definition.key,
          step_name: definition.name,
          step_type: definition.type,
          is_required: definition.required,
          status: 'pending',
          attempt_count: 0,
          last_error: null,
          notes: null,
          completed_by: null,
          completed_at: null,
          sort_order: definition.sortOrder,
        })),
        events: [],
        readiness: {
          can_start: client.status === 'draft' || client.status === 'onboarding',
          can_activate: false,
          blockers: ['Onboarding has not started yet.'],
          initial_admin: initialAdmin
            ? {
                id: initialAdmin.id,
                full_name: initialAdmin.full_name,
                user_name: initialAdmin.user_name,
                email: initialAdmin.email,
                status: initialAdmin.status,
                is_active: initialAdmin.is_active,
              }
            : null,
        },
      };
    }

    const [steps, events, initialAdmin] = await Promise.all([
      this.onboardingStepRepository.find({
        where: { onboarding_id: onboarding.id },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.onboardingEventRepository.find({
        where: { onboarding_id: onboarding.id },
        order: { created_at: 'DESC', id: 'DESC' },
      }),
      this.resolvePreferredClientAdmin(clientId, onboarding.initial_admin_user_id ?? undefined),
    ]);

    return {
      client: this.serializeClient(client),
      current_subscription: currentSubscription ? this.serializeSubscription(currentSubscription) : null,
      onboarding: this.serializeOnboarding(onboarding),
      steps: steps.map((step) => this.serializeStep(step)),
      events: events.map((event) => this.serializeEvent(event)),
      readiness: this.buildReadiness(onboarding, steps, initialAdmin),
    };
  }

  async getTimeline(clientId: string): Promise<any[]> {
    const onboarding = await this.getLatestOnboarding(clientId);
    if (!onboarding) {
      return [];
    }

    const events = await this.onboardingEventRepository.find({
      where: { onboarding_id: onboarding.id },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    return events.map((event) => this.serializeEvent(event));
  }

  async startOnboarding(clientId: string, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const client = await this.clientRepository.findOne({ where: buildClientLookupWhere(clientId) });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    const clientCode = client.client_code;

    if (!['draft', 'onboarding'].includes(client.status)) {
      throw new BadRequestException('Onboarding can only start for draft or onboarding clients');
    }

    const existingOpen = await this.onboardingRepository.findOne({
      where: OPEN_ONBOARDING_STATUSES.map((status) => ({ client_id: clientCode, status })),
      order: { created_at: 'DESC', id: 'DESC' },
    });
    if (existingOpen) {
      throw new BadRequestException('An onboarding workflow is already active for this client');
    }

    const onboarding = this.onboardingRepository.create({
      client_id: clientCode,
      status: 'in_progress',
      current_stage: 'Registry Verification',
      started_by: actorId ?? null,
      started_at: new Date(),
      failure_summary: null,
    });

    const savedOnboarding = await this.onboardingRepository.save(onboarding);
    const steps = STEP_DEFINITIONS.map((definition) =>
      this.onboardingStepRepository.create({
        onboarding_id: savedOnboarding.id,
        client_id: clientCode,
        step_key: definition.key,
        step_name: definition.name,
        step_type: definition.type,
        is_required: definition.required,
        status: 'pending',
        attempt_count: 0,
        sort_order: definition.sortOrder,
      }),
    );
    await this.onboardingStepRepository.save(steps);

    const existingInitialAdmin = await this.resolvePreferredClientAdmin(clientCode);
    if (existingInitialAdmin) {
      savedOnboarding.initial_admin_user_id = Number(existingInitialAdmin.id);
      await this.onboardingRepository.save(savedOnboarding);
    }

    if (client.status === 'draft') {
      const previousStatus = client.status;
      client.status = 'onboarding';
      await this.clientRepository.save(client);
        await this.statusHistoryRepository.save(this.statusHistoryRepository.create({
        client_id: clientCode,
        from_status: previousStatus,
        to_status: 'onboarding',
        reason: 'Onboarding started',
        notes: null,
        changed_by: actorId ?? null,
      }));
    }

    await this.logEvent(savedOnboarding.id, clientCode, 'started', 'Onboarding started', null, actorId, {
      started_at: savedOnboarding.started_at,
    });

    await this.assignConfiguredBlueprintIfPresent(savedOnboarding, client, actorId);

    await this.operationalAuditService.log({
      user,
      action: 'Start Onboarding',
      entity: 'ClientOnboarding',
      clientId: clientCode,
      entityId: savedOnboarding.id,
      portal: 'Nexus',
      details: `Started onboarding for ${client.client_name}`,
    });

    await this.recomputeOnboardingState(clientCode);
    return this.getClientOnboarding(clientCode);
  }

  async updateManualStep(
    clientId: string,
    stepKey: string,
    dto: UpdateOnboardingStepDto,
    user?: JwtPayload,
  ): Promise<any> {
    const actorId = resolveActorId(user);
    const onboarding = await this.getRequiredOpenOnboarding(clientId);
    const step = await this.getRequiredStep(onboarding.id, clientId, stepKey);

    if (step.step_type === 'system' || step.step_key === 'client_activated') {
      throw new BadRequestException('This step is system-controlled');
    }

    const previousStatus = step.status;
    step.status = dto.status as ClientOnboardingStepStatus;
    step.notes = dto.notes?.trim() || null;
    step.last_error = dto.status === 'failed' || dto.status === 'blocked'
      ? dto.notes?.trim() || step.last_error || 'Step requires follow-up'
      : null;
    step.completed_by = dto.status === 'completed' ? actorId ?? null : null;
    step.completed_at = dto.status === 'completed' ? new Date() : null;
    await this.onboardingStepRepository.save(step);

    if (step.step_key === 'readiness_review') {
      onboarding.readiness_verified_by = step.status === 'completed' ? actorId ?? null : null;
      onboarding.readiness_verified_at = step.status === 'completed' ? new Date() : null;
      await this.onboardingRepository.save(onboarding);
    }

    await this.logEvent(
      onboarding.id,
      clientId,
      'step_updated',
      `${step.step_name} marked ${step.status}`,
      step.step_key,
      actorId,
      { from_status: previousStatus, to_status: step.status, notes: step.notes },
    );

    await this.operationalAuditService.log({
      user,
      action: 'Update Onboarding Step',
      entity: 'ClientOnboardingStep',
      clientId,
      entityId: step.id,
      portal: 'Nexus',
      details: `${step.step_name} updated to ${step.status}`,
      diff: [
        { field: 'step_status', oldValue: previousStatus, newValue: step.status },
      ],
    });

    await this.recomputeOnboardingState(clientId);
    return this.getClientOnboarding(clientId);
  }

  async retryStep(clientId: string, stepKey: string, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const onboarding = await this.getRequiredOpenOnboarding(clientId);
    const step = await this.getRequiredStep(onboarding.id, clientId, stepKey);

    step.attempt_count = Number(step.attempt_count || 0) + 1;
    step.last_error = null;
    step.notes = null;
    step.completed_by = null;
    step.completed_at = null;
    step.status = step.step_type === 'system' ? 'pending' : 'in_progress';
    await this.onboardingStepRepository.save(step);

    await this.logEvent(
      onboarding.id,
      clientId,
      'step_retried',
      `Retry triggered for ${step.step_name}`,
      step.step_key,
      actorId,
      { attempt_count: step.attempt_count },
    );

    await this.operationalAuditService.log({
      user,
      action: 'Retry Onboarding Step',
      entity: 'ClientOnboardingStep',
      clientId,
      entityId: step.id,
      portal: 'Nexus',
      details: `Retry requested for ${step.step_name}`,
      metadata: { step_key: step.step_key, attempt_count: step.attempt_count },
    });

    await this.recomputeOnboardingState(clientId);
    return this.getClientOnboarding(clientId);
  }

  async createInitialAdmin(
    clientId: string,
    dto: CreateInitialAdminDto,
    user?: JwtPayload,
  ): Promise<any> {
    const actorId = resolveActorId(user);
    const onboarding = await this.getRequiredOpenOnboarding(clientId);
    const client = await this.clientRepository.findOne({ where: { client_code: clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (onboarding.initial_admin_user_id) {
      throw new BadRequestException('Initial admin is already configured for this onboarding');
    }

    const clientAdminRole = await this.ensureClientAdminRole(clientId);
    const createdUser = await this.usersService.create(clientId, {
      full_name: dto.full_name.trim(),
      user_name: dto.user_name.trim(),
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
      phone: dto.phone?.trim(),
      role_id: clientAdminRole.id,
      user_type: 'CLIENT_ADMIN',
      status: 'inactive',
    });

    onboarding.initial_admin_user_id = Number(createdUser.id);
    onboarding.failure_summary = null;
    await this.onboardingRepository.save(onboarding);

    const step = await this.getRequiredStep(onboarding.id, clientId, 'initial_admin_created');
    step.status = 'completed';
    step.completed_by = actorId ?? null;
    step.completed_at = new Date();
    step.notes = `Initial admin prepared: ${createdUser.email || createdUser.user_name}`;
    step.last_error = null;
    step.metadata_json = JSON.stringify({
      user_id: createdUser.id,
      email: createdUser.email,
      user_name: createdUser.user_name,
    });
    await this.onboardingStepRepository.save(step);

    await this.logEvent(
      onboarding.id,
      clientId,
      'initial_admin_created',
      `Initial admin ${createdUser.user_name} created`,
      'initial_admin_created',
      actorId,
      { user_id: createdUser.id, email: createdUser.email },
    );

    await this.operationalAuditService.log({
      user,
      action: 'Create Initial Admin',
      entity: 'ClientOnboarding',
      clientId,
      entityId: onboarding.id,
      portal: 'Nexus',
      details: `Initial admin prepared for ${client.client_name}`,
      metadata: { user_id: createdUser.id, email: createdUser.email },
    });

    await this.recomputeOnboardingState(clientId);
    return this.getClientOnboarding(clientId);
  }

  async activateClient(clientId: string, user?: JwtPayload): Promise<any> {
    const actorId = resolveActorId(user);
    const onboarding = await this.getRequiredOpenOnboarding(clientId);
    await this.recomputeOnboardingState(clientId);

    const refreshed = await this.onboardingRepository.findOne({ where: { id: onboarding.id } });
    if (!refreshed) {
      throw new NotFoundException('Onboarding not found');
    }

    const detail = await this.getClientOnboarding(clientId);
    if (!detail.readiness?.can_activate || refreshed.status !== 'ready_for_activation') {
      const blockerText = Array.isArray(detail.readiness?.blockers) && detail.readiness.blockers.length > 0
        ? detail.readiness.blockers.join(' ')
        : 'Complete all required onboarding steps before activation.';
      throw new BadRequestException(blockerText);
    }

    if (!refreshed.initial_admin_user_id) {
      throw new BadRequestException('Initial admin must be created before activation');
    }

    await this.dataSource.transaction(async (manager) => {
      const client = await manager.findOne(Client, { where: { client_code: clientId } });
      if (!client) {
        throw new NotFoundException('Client not found');
      }

      const onboardingRecord = await manager.findOne(ClientOnboarding, { where: { id: refreshed.id } });
      if (!onboardingRecord) {
        throw new NotFoundException('Onboarding not found');
      }

      const initialAdmin = await manager.findOne(UserManagement, {
        where: { id: refreshed.initial_admin_user_id!, client_id: clientId },
      });
      if (!initialAdmin) {
        throw new BadRequestException('Initial admin record could not be resolved');
      }

      await this.assertWithinActiveUserLimit(clientId, initialAdmin.id);

      const previousStatus = client.status;
      client.status = 'active';
      await manager.save(Client, client);

      if (previousStatus !== 'active') {
        await manager.save(ClientStatusHistory, manager.create(ClientStatusHistory, {
          client_id: clientId,
          from_status: previousStatus as any,
          to_status: 'active',
          reason: 'Activated through onboarding workflow',
          notes: null,
          changed_by: actorId ?? null,
        }));
      }

      initialAdmin.status = 'active';
      initialAdmin.is_active = true;
      await manager.save(UserManagement, initialAdmin);

      const activationStep = await manager.findOne(ClientOnboardingStep, {
        where: { onboarding_id: onboardingRecord.id, client_id: clientId, step_key: 'client_activated' },
      });
      if (!activationStep) {
        throw new NotFoundException('Activation step not found');
      }

      activationStep.status = 'completed';
      activationStep.completed_by = actorId ?? null;
      activationStep.completed_at = new Date();
      activationStep.last_error = null;
      activationStep.notes = `Client activated with initial admin ${initialAdmin.user_name}`;
      await manager.save(ClientOnboardingStep, activationStep);

      onboardingRecord.status = 'completed';
      onboardingRecord.current_stage = 'Completed';
      onboardingRecord.failure_summary = null;
      onboardingRecord.completed_at = new Date();
      onboardingRecord.last_evaluated_at = new Date();
      await manager.save(ClientOnboarding, onboardingRecord);

      await manager.save(ClientOnboardingEvent, manager.create(ClientOnboardingEvent, {
        onboarding_id: onboardingRecord.id,
        client_id: clientId,
        event_type: 'activated',
        step_key: 'client_activated',
        message: 'Client activated through onboarding workflow',
        details_json: JSON.stringify({
          initial_admin_user_id: initialAdmin.id,
          previous_status: previousStatus,
        }),
        created_by: actorId ?? null,
      }));
    });

    await this.operationalAuditService.log({
      user,
      action: 'Activate Client',
      entity: 'ClientOnboarding',
      clientId,
      entityId: refreshed.id,
      portal: 'Nexus',
      details: 'Client activated through onboarding workflow',
    });

    return this.getClientOnboarding(clientId);
  }

  async hasBlockingOnboardingForActivation(clientId: string): Promise<boolean> {
    const latest = await this.getLatestOnboarding(clientId);
    if (!latest) {
      return false;
    }

    return latest.status !== 'completed';
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
      throw new NotFoundException('Onboarding has not been started for this client');
    }
    if (['completed', 'cancelled'].includes(onboarding.status)) {
      throw new BadRequestException('This onboarding workflow is not open for changes');
    }
    return onboarding;
  }

  private async getRequiredStep(
    onboardingId: number,
    clientId: string,
    stepKey: string,
  ): Promise<ClientOnboardingStep> {
    const step = await this.onboardingStepRepository.findOne({
      where: { onboarding_id: onboardingId, client_id: clientId, step_key: stepKey },
    });
    if (!step) {
      throw new NotFoundException(`Onboarding step ${stepKey} not found`);
    }
    return step;
  }

  private async assignConfiguredBlueprintIfPresent(
    onboarding: ClientOnboarding,
    client: Client,
    actorId?: string,
  ): Promise<void> {
    const configuredCode = client.onboarding_blueprint?.trim().toUpperCase();
    if (!configuredCode) {
      return;
    }

    const blueprint = await this.blueprintRepository.findOne({
      where: { blueprint_code: configuredCode },
      select: ['id', 'blueprint_name', 'status', 'active_version_id'],
    });
    if (!blueprint || blueprint.status !== 'active' || !blueprint.active_version_id) {
      return;
    }

    const version = await this.blueprintVersionRepository.findOne({
      where: { id: blueprint.active_version_id, blueprint_id: blueprint.id },
      select: ['id', 'version_no'],
    });
    if (!version) {
      return;
    }

    await this.clientBlueprintAssignmentRepository.save(
      this.clientBlueprintAssignmentRepository.create({
        client_id: client.client_code,
        onboarding_id: onboarding.id,
        blueprint_id: blueprint.id,
        blueprint_version_id: version.id,
        assignment_status: 'assigned',
        assigned_by: actorId ?? null,
        failure_summary: null,
      }),
    );

    await this.logEvent(
      onboarding.id,
      client.client_code,
      'blueprint_assigned',
      `Blueprint ${blueprint.blueprint_name} assigned from client onboarding defaults`,
      'blueprint_applied',
      actorId,
      {
        blueprint_id: blueprint.id,
        blueprint_version_id: version.id,
        version_no: version.version_no,
      },
    );
  }

  private async recomputeOnboardingState(clientId: string): Promise<void> {
    const onboarding = await this.getLatestOnboarding(clientId);
    if (!onboarding || ['completed', 'cancelled'].includes(onboarding.status)) {
      return;
    }

    const [client, currentSubscription, steps, initialAdmin, latestBlueprintAssignment] = await Promise.all([
      this.clientRepository.findOne({ where: { client_code: clientId } }),
      this.getCurrentSubscription(clientId),
      this.onboardingStepRepository.find({
        where: { onboarding_id: onboarding.id },
        order: { sort_order: 'ASC', id: 'ASC' },
      }),
      this.resolvePreferredClientAdmin(clientId, onboarding.initial_admin_user_id ?? undefined),
      this.clientBlueprintAssignmentRepository.findOne({
        where: { client_id: clientId, onboarding_id: onboarding.id },
        relations: ['blueprint', 'blueprint_version'],
        order: { created_at: 'DESC', id: 'DESC' },
      }),
    ]);

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const registryBlockers = await this.getRegistryBlockers(client);
    const subscriptionBlockers = this.getSubscriptionBlockers(currentSubscription);

    const stepMap = new Map(steps.map((step) => [step.step_key as StepKey, step]));

    const registryStep = stepMap.get('registry_verified');
    if (registryStep) {
      this.applySystemStepOutcome(registryStep, registryBlockers.length === 0, registryBlockers.join(' '));
    }

    const subscriptionStep = stepMap.get('subscription_verified');
    if (subscriptionStep) {
      this.applySystemStepOutcome(subscriptionStep, subscriptionBlockers.length === 0, subscriptionBlockers.join(' '));
    }

    const blueprintStep = stepMap.get('blueprint_applied');
    if (blueprintStep) {
      if (!latestBlueprintAssignment) {
        blueprintStep.status = 'pending';
        blueprintStep.completed_by = null;
        blueprintStep.completed_at = null;
        blueprintStep.last_error = null;
        blueprintStep.notes = null;
      } else if (latestBlueprintAssignment.assignment_status === 'applied') {
        blueprintStep.status = 'completed';
        blueprintStep.completed_at = blueprintStep.completed_at || latestBlueprintAssignment.applied_at || new Date();
        blueprintStep.last_error = null;
        blueprintStep.notes = `${latestBlueprintAssignment.blueprint?.blueprint_name || 'Blueprint'} v${latestBlueprintAssignment.blueprint_version?.version_no || '?'}`;
      } else if (latestBlueprintAssignment.assignment_status === 'failed') {
        blueprintStep.status = 'failed';
        blueprintStep.completed_by = null;
        blueprintStep.completed_at = null;
        blueprintStep.last_error = latestBlueprintAssignment.failure_summary || 'Blueprint application failed';
      } else {
        blueprintStep.status = 'in_progress';
        blueprintStep.completed_by = null;
        blueprintStep.completed_at = null;
        blueprintStep.last_error = null;
        blueprintStep.notes = `${latestBlueprintAssignment.blueprint?.blueprint_name || 'Blueprint'} assigned and awaiting application`;
      }
    }

    if (!onboarding.initial_admin_user_id && initialAdmin) {
      onboarding.initial_admin_user_id = Number(initialAdmin.id);
    }

    const initialAdminStep = stepMap.get('initial_admin_created');
    if (initialAdminStep && !onboarding.initial_admin_user_id) {
      initialAdminStep.status = 'pending';
      initialAdminStep.completed_by = null;
      initialAdminStep.completed_at = null;
      initialAdminStep.last_error = null;
      initialAdminStep.notes = null;
    } else if (initialAdminStep && initialAdmin) {
      initialAdminStep.status = 'completed';
      initialAdminStep.completed_at = initialAdminStep.completed_at || initialAdmin.created_at || new Date();
      initialAdminStep.last_error = null;
      initialAdminStep.notes = initialAdminStep.notes || `Initial admin prepared: ${initialAdmin.email || initialAdmin.user_name}`;
    }

    const activationStep = stepMap.get('client_activated');
    if (activationStep) {
      if (client.status === 'active') {
        activationStep.status = 'completed';
        activationStep.completed_at = activationStep.completed_at || new Date();
        activationStep.last_error = null;
      } else {
        activationStep.status = 'pending';
        activationStep.completed_by = null;
        activationStep.completed_at = null;
        activationStep.last_error = null;
      }
    }

    await this.onboardingStepRepository.save([...stepMap.values()]);

    const preActivationSteps = [...stepMap.values()].filter((step) => step.step_key !== 'client_activated' && step.is_required);
    const failedSteps = preActivationSteps.filter((step) => step.status === 'failed');
    const blockedSteps = preActivationSteps.filter((step) => step.status === 'blocked');
    const incompleteSteps = preActivationSteps.filter((step) => step.status !== 'completed');
    const nextIncomplete = [...stepMap.values()].find((step) => step.status !== 'completed');

    onboarding.current_stage = nextIncomplete?.step_name || 'Completed';
    onboarding.last_evaluated_at = new Date();

    if (failedSteps.length > 0) {
      onboarding.status = 'failed';
      onboarding.failure_summary = failedSteps.map((step) => step.last_error || `${step.step_name} failed`).join(' | ');
    } else if (blockedSteps.length > 0) {
      onboarding.status = 'blocked';
      onboarding.failure_summary = blockedSteps.map((step) => step.last_error || `${step.step_name} blocked`).join(' | ');
    } else if (client.status === 'active') {
      onboarding.status = 'completed';
      onboarding.current_stage = 'Completed';
      onboarding.completed_at = onboarding.completed_at || new Date();
      onboarding.failure_summary = null;
    } else if (incompleteSteps.length === 0) {
      onboarding.status = 'ready_for_activation';
      onboarding.current_stage = 'Activation Readiness';
      onboarding.failure_summary = null;
    } else {
      onboarding.status = 'in_progress';
      onboarding.failure_summary = null;
    }

    await this.onboardingRepository.save(onboarding);
  }

  private async getRegistryBlockers(client: Client): Promise<string[]> {
    const blockers: string[] = [];
    if (!client.client_name?.trim()) blockers.push('Client display name is required.');
    if (!client.legal_name?.trim()) blockers.push('Legal name is required.');
    if (!client.client_code?.trim()) blockers.push('Client code is required.');
    if (!client.domain_slug?.trim()) blockers.push('Domain slug is required.');
    if (!client.currency?.trim()) blockers.push('Currency is required.');
    if (!client.language?.trim()) blockers.push('Language is required.');
    if (!client.timezone?.trim()) blockers.push('Timezone is required.');

    const contacts = await this.contactRepository.find({ where: { client_id: client.client_code, is_active: true } });
    for (const contactType of ['business_primary', 'billing_primary', 'operations_primary'] as const) {
      const contact = contacts.find((entry) => entry.contact_type === contactType);
      if (!contact) {
        blockers.push(`Missing ${contactType.replace('_', ' ')} contact.`);
        continue;
      }
      if (!contact.full_name?.trim()) {
        blockers.push(`${contactType.replace('_', ' ')} contact name is required.`);
      }
      if (!contact.email?.trim() && !contact.phone?.trim()) {
        blockers.push(`${contactType.replace('_', ' ')} contact requires email or phone.`);
      }
    }

    return blockers;
  }

  private getSubscriptionBlockers(subscription: ClientSubscription | null): string[] {
    if (!subscription) {
      return ['A commercial subscription must be assigned before onboarding can continue.'];
    }

    if (!['active', 'trial', 'grace'].includes(subscription.status)) {
      return [`Current subscription status ${subscription.status} does not allow activation.`];
    }

    return [];
  }

  private applySystemStepOutcome(
    step: ClientOnboardingStep,
    isSuccessful: boolean,
    errorMessage: string | null,
  ): void {
    if (isSuccessful) {
      step.status = 'completed';
      step.completed_at = step.completed_at || new Date();
      step.last_error = null;
    } else {
      step.status = 'blocked';
      step.completed_by = null;
      step.completed_at = null;
      step.last_error = errorMessage || 'This step is blocked';
    }
  }

  private buildReadiness(
    onboarding: ClientOnboarding,
    steps: ClientOnboardingStep[],
    initialAdmin: UserManagement | null,
  ) {
    const blockers = steps
      .filter((step) => step.is_required && step.step_key !== 'client_activated' && step.status !== 'completed')
      .map((step) => step.last_error || `${step.step_name} is ${step.status}.`);

    return {
      can_start: false,
      can_activate: onboarding.status === 'ready_for_activation' && blockers.length === 0 && Boolean(initialAdmin),
      blockers,
      initial_admin: initialAdmin
        ? {
            id: initialAdmin.id,
            full_name: initialAdmin.full_name,
            user_name: initialAdmin.user_name,
            email: initialAdmin.email,
            status: initialAdmin.status,
            is_active: initialAdmin.is_active,
          }
        : null,
    };
  }

  private async getCurrentSubscription(clientId: string): Promise<ClientSubscription | null> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { client_id: clientId },
      relations: ['plan'],
      order: {
        effective_start_at: 'DESC',
        created_at: 'DESC',
      },
    });

    return this.resolveCurrentSubscription(subscriptions);
  }

  private resolveCurrentSubscription(subscriptions: ClientSubscription[]): ClientSubscription | null {
    const priority: Array<ClientSubscription['status']> = ['active', 'grace', 'trial', 'suspended', 'pending'];
    for (const status of priority) {
      const match = subscriptions.find((subscription) => subscription.status === status);
      if (match) {
        return match;
      }
    }
    return subscriptions[0] || null;
  }

  private serializeClient(client: Client) {
    return {
      id: client.id,
      client_code: client.client_code,
      client_name: client.client_name,
      legal_name: client.legal_name,
      short_name: client.short_name,
      domain_slug: client.domain_slug,
      business_type: client.business_type,
      status: client.status,
      currency: client.currency,
      language: client.language,
      timezone: client.timezone,
      created_at: client.created_at,
      updated_at: client.updated_at,
    };
  }

  private serializeSubscription(subscription: ClientSubscription) {
    return {
      id: subscription.id,
      plan_id: subscription.plan_id,
      plan_name: subscription.plan_name_snapshot,
      plan_code: subscription.plan_code_snapshot,
      status: subscription.status,
      billing_cycle: subscription.billing_cycle,
      is_trial: subscription.is_trial,
      trial_start_at: subscription.trial_start_at,
      trial_end_at: subscription.trial_end_at,
      effective_start_at: subscription.effective_start_at,
      effective_end_at: subscription.effective_end_at,
      price_snapshot: subscription.price_snapshot !== null && subscription.price_snapshot !== undefined
        ? Number(subscription.price_snapshot)
        : null,
    };
  }

  private serializeOnboarding(onboarding: ClientOnboarding) {
    return {
      id: onboarding.id,
      status: onboarding.status,
      current_stage: onboarding.current_stage,
      started_by: onboarding.started_by,
      started_at: onboarding.started_at,
      initial_admin_user_id: onboarding.initial_admin_user_id,
      failure_summary: onboarding.failure_summary,
      readiness_verified_by: onboarding.readiness_verified_by,
      readiness_verified_at: onboarding.readiness_verified_at,
      completed_at: onboarding.completed_at,
      cancelled_at: onboarding.cancelled_at,
      last_evaluated_at: onboarding.last_evaluated_at,
      created_at: onboarding.created_at,
      updated_at: onboarding.updated_at,
    };
  }

  private serializeStep(step: ClientOnboardingStep) {
    return {
      id: step.id,
      step_key: step.step_key,
      step_name: step.step_name,
      step_type: step.step_type,
      is_required: step.is_required,
      status: step.status,
      attempt_count: step.attempt_count,
      last_error: step.last_error,
      notes: step.notes,
      completed_by: step.completed_by,
      completed_at: step.completed_at,
      sort_order: step.sort_order,
      metadata: step.metadata_json ? this.safeParseJson(step.metadata_json) : null,
      created_at: step.created_at,
      updated_at: step.updated_at,
    };
  }

  private serializeEvent(event: ClientOnboardingEvent) {
    return {
      id: event.id,
      event_type: event.event_type,
      step_key: event.step_key,
      message: event.message,
      details: event.details_json ? this.safeParseJson(event.details_json) : null,
      created_by: event.created_by,
      created_at: event.created_at,
    };
  }

  private safeParseJson(value: string | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private async logEvent(
    onboardingId: number,
    clientId: string,
    eventType: string,
    message: string,
    stepKey: string | null,
    actorId?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.onboardingEventRepository.save(this.onboardingEventRepository.create({
      onboarding_id: onboardingId,
      client_id: clientId,
      event_type: eventType,
      step_key: stepKey,
      message,
      details_json: details ? JSON.stringify(details) : null,
      created_by: actorId ?? null,
    }));
  }

  private async assertWithinActiveUserLimit(clientId: string, activatingUserId?: number): Promise<void> {
    const [client, override, activeUsers] = await Promise.all([
      this.clientRepository.findOne({ where: { client_code: clientId } }),
      this.clientLimitOverrideRepository.findOne({ where: { client_id: clientId, limit_key: 'max_active_users' } }),
      this.userRepository.count({
        where: {
          client_id: clientId,
          status: 'active',
          is_active: true,
        },
      }),
    ]);

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const initialAdmin = activatingUserId
      ? await this.userRepository.findOne({ where: { id: activatingUserId, client_id: clientId } })
      : null;
    const alreadyActive = Boolean(initialAdmin && initialAdmin.status === 'active' && initialAdmin.is_active);
    const effectiveLimit = override?.limit_value ?? client.max_users ?? null;
    if (effectiveLimit === null || effectiveLimit === undefined || effectiveLimit <= 0) {
      return;
    }

    const projectedActiveUsers = activeUsers + (alreadyActive ? 0 : 1);
    if (projectedActiveUsers > effectiveLimit) {
      throw new BadRequestException(`Activating this client would exceed the active user limit (${effectiveLimit})`);
    }
  }

  private async ensureClientAdminRole(clientId: string): Promise<Role> {
    await this.rolesService.ensureDefaultRoles(clientId);
    const clientAdminRole = await this.roleRepository.findOne({
      where: { client_id: clientId, role_name: 'Client Admin', is_active: true },
    });

    if (!clientAdminRole) {
      throw new NotFoundException('Client Admin role is not configured for this client');
    }

    return clientAdminRole;
  }

  private async resolvePreferredClientAdmin(
    clientId: string,
    explicitUserId?: number,
  ): Promise<UserManagement | null> {
    if (explicitUserId) {
      const explicitUser = await this.userRepository.findOne({
        where: { id: explicitUserId, client_id: clientId },
      });
      if (explicitUser) {
        return explicitUser;
      }
    }

    return this.userRepository.findOne({
      where: { client_id: clientId, user_type: 'CLIENT_ADMIN' },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }
}
