import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { buildClientLookupWhere } from '../client-lookup.util';
import { AuditLog } from '../entities/audit-log.entity';
import { BlueprintApplicationLog } from '../entities/blueprint-application-log.entity';
import { ClientBlueprintAssignment } from '../entities/client-blueprint-assignment.entity';
import { ClientOnboardingStep } from '../entities/client-onboarding-step.entity';
import { ClientOnboarding } from '../entities/client-onboarding.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { Client } from '../entities/client.entity';
import { BlueprintsService } from '../blueprints/blueprints.service';
import { ClientsService } from '../clients/clients.service';
import { ClientGovernanceService } from '../clients/client-governance.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { Branch } from '../../setup/entities/branch.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { PosDevice } from '../../pos/entities/pos-device.entity';
import { PosSyncEvent } from '../../pos/entities/pos-sync-event.entity';

type DashboardSeverity = 'info' | 'warning' | 'critical';
type HealthStatus = 'healthy' | 'warning' | 'critical';

interface SupportQueueItem {
  client_id: string;
  client_code: string | null;
  client_name: string;
  client_status: string;
  governance_state: string;
  subscription_status: string | null;
  current_plan_name: string | null;
  severity: DashboardSeverity;
  reason: string;
  warnings?: string[];
  onboarding_status?: string;
  current_stage?: string | null;
  blockers?: string[];
  issue_count?: number;
}

@Injectable()
export class SupportWorkspaceService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientSubscription)
    private readonly clientSubscriptionRepository: Repository<ClientSubscription>,
    @InjectRepository(ClientOnboarding)
    private readonly onboardingRepository: Repository<ClientOnboarding>,
    @InjectRepository(ClientOnboardingStep)
    private readonly onboardingStepRepository: Repository<ClientOnboardingStep>,
    @InjectRepository(ClientBlueprintAssignment)
    private readonly blueprintAssignmentRepository: Repository<ClientBlueprintAssignment>,
    @InjectRepository(BlueprintApplicationLog)
    private readonly blueprintLogRepository: Repository<BlueprintApplicationLog>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserManagement)
    private readonly userRepository: Repository<UserManagement>,
    @InjectRepository(PosDevice)
    private readonly posDeviceRepository: Repository<PosDevice>,
    @InjectRepository(PosSyncEvent)
    private readonly posSyncEventRepository: Repository<PosSyncEvent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly clientsService: ClientsService,
    private readonly onboardingService: OnboardingService,
    private readonly entitlementsService: EntitlementsService,
    private readonly clientGovernanceService: ClientGovernanceService,
    private readonly blueprintsService: BlueprintsService,
    private readonly auditService: AuditService,
  ) {}

  async getDashboard(): Promise<any> {
    const [clients, subscriptions, onboardingQueue, branches, syncStatusRows, syncEvents, devices, failedSteps, failedAssignments, auditSignals] =
      await Promise.all([
        this.clientRepository.find({ order: { updated_at: 'DESC' } }),
        this.clientSubscriptionRepository.find({
          relations: ['plan'],
          order: { effective_start_at: 'DESC', created_at: 'DESC' },
        }),
        this.onboardingService.listQueue(),
        this.branchRepository.find({ order: { branch_name: 'ASC' } }),
        this.posSyncEventRepository.createQueryBuilder('event')
          .select('event.status', 'status')
          .addSelect('COUNT(event.id)', 'total')
          .groupBy('event.status')
          .getRawMany<{ status: string; total: string }>(),
        this.posSyncEventRepository.find({
          where: { status: In(['failed', 'conflict']) as any },
          relations: ['device', 'branch'],
          order: { created_at: 'DESC', id: 'DESC' },
          take: 30,
        }),
        this.posDeviceRepository.find({
          where: { last_sync_status: In(['failed', 'conflict']) as any },
          relations: ['branch'],
          order: { updated_at: 'DESC', id: 'DESC' },
          take: 20,
        }),
        this.onboardingStepRepository.find({
          where: { status: In(['failed', 'blocked']) as any },
          order: { updated_at: 'DESC', id: 'DESC' },
          take: 30,
        }),
        this.blueprintAssignmentRepository.find({
          where: { assignment_status: 'failed' as any },
          relations: ['blueprint'],
          order: { updated_at: 'DESC', id: 'DESC' },
          take: 20,
        }),
        this.auditLogRepository.createQueryBuilder('audit')
          .where('audit.status IN (:...statuses)', { statuses: ['warning', 'error'] })
          .orderBy('audit.timestamp', 'DESC')
          .addOrderBy('audit.id', 'DESC')
          .take(20)
          .getMany(),
      ]);

    const subscriptionMap = this.buildCurrentSubscriptionMap(subscriptions);
    const clientMap = new Map(clients.map((client) => [client.client_code, client]));
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
    const entitlements = await Promise.all(
      clients.map(async (client) => [client.client_code, await this.entitlementsService.getEffectiveEntitlements(client.client_code)] as const),
    );
    const entitlementsMap = new Map(entitlements);

    const blocked_clients: SupportQueueItem[] = [];
    const governance_attention: SupportQueueItem[] = [];
    const limit_attention: SupportQueueItem[] = [];

    for (const client of clients) {
      const entitlement = entitlementsMap.get(client.client_code);
      const subscription = subscriptionMap.get(client.client_code) || null;
      if (entitlement?.blocking_reason) {
        blocked_clients.push(this.createQueueItem(client, subscription, 'critical', entitlement.blocking_reason, entitlement.warnings || []));
      }
      if ((client.governance_state || 'normal') !== 'normal') {
        governance_attention.push(
          this.createQueueItem(
            client,
            subscription,
            ['suspended', 'closure_pending', 'closed'].includes(client.governance_state || '') ? 'critical' : 'warning',
            client.governance_reason || `Governance state is ${client.governance_state || 'normal'}`,
          ),
        );
      }
      if (Array.isArray(entitlement?.warnings) && entitlement.warnings.length > 0) {
        limit_attention.push(
          this.createQueueItem(
            client,
            subscription,
            entitlement.warnings.some((warning: string) => warning.includes('limit reached')) ? 'critical' : 'warning',
            entitlement.warnings[0],
            entitlement.warnings,
          ),
        );
      }
    }

    const onboarding_attention: SupportQueueItem[] = (Array.isArray(onboardingQueue) ? onboardingQueue : [])
      .filter((row) => ['not_started', 'blocked', 'failed', 'ready_for_activation'].includes(row.onboarding_status))
      .map((row) => ({
        client_id: row.client_id,
        client_code: row.client_code,
        client_name: row.client_name,
        client_status: row.client_status,
        governance_state: clientMap.get(row.client_id)?.governance_state || 'normal',
        subscription_status: row.subscription_status || null,
        current_plan_name: row.current_plan_name || null,
        severity: ['blocked', 'failed'].includes(row.onboarding_status) ? 'critical' : 'warning',
        reason: Array.isArray(row.blockers) && row.blockers.length ? row.blockers[0] : row.current_stage || 'Onboarding requires attention',
        onboarding_status: row.onboarding_status,
        current_stage: row.current_stage,
        blockers: Array.isArray(row.blockers) ? row.blockers : [],
      }));

    const sync_attention = this.buildSyncQueue(syncEvents, devices, clientMap, subscriptionMap);
    const failed_jobs_attention = this.buildFailedJobQueue(failedSteps, failedAssignments, clientMap, subscriptionMap);
    const client_health = this.buildHealthQueue(clients, blocked_clients, governance_attention, limit_attention, onboarding_attention, sync_attention, failed_jobs_attention);
    const tenant_usage_summary = this.buildUsageSummary(clients, subscriptionMap, entitlementsMap);
    const diagnostics_preview = this.buildDiagnosticsPreview(syncEvents, failedSteps, failedAssignments, auditSignals, clientMap, branchMap);

    const syncTotals = { pending: 0, processed: 0, failed: 0, conflict: 0 };
    for (const row of syncStatusRows) {
      const key = String(row.status || '').toLowerCase() as keyof typeof syncTotals;
      if (key in syncTotals) syncTotals[key] = Number(row.total || 0);
    }

    const issue_summary = {
      open_issues: blocked_clients.length + governance_attention.length + limit_attention.length + syncTotals.failed + syncTotals.conflict + failedSteps.length + failedAssignments.length,
      critical: blocked_clients.length + syncTotals.failed + syncTotals.conflict + failedSteps.filter((step) => step.status === 'failed').length + failedAssignments.length,
      warning: governance_attention.length + limit_attention.length + onboarding_attention.length + failedSteps.filter((step) => step.status === 'blocked').length,
      categories: [
        { key: 'blocked_clients', label: 'Blocked Clients', count: blocked_clients.length, severity: 'critical' },
        { key: 'governance_attention', label: 'Governance Attention', count: governance_attention.length, severity: 'warning' },
        { key: 'limit_attention', label: 'Usage & Limits', count: limit_attention.length, severity: 'warning' },
        { key: 'sync_failed', label: 'Failed Sync Events', count: syncTotals.failed, severity: 'critical' },
        { key: 'sync_conflict', label: 'Sync Conflicts', count: syncTotals.conflict, severity: 'critical' },
        { key: 'failed_jobs', label: 'Failed Jobs', count: failedSteps.length + failedAssignments.length, severity: 'critical' },
      ],
    };

    return {
      metrics: {
        total_clients: clients.length,
        active_clients: clients.filter((client) => client.status === 'active').length,
        blocked_clients: blocked_clients.length,
        onboarding_attention: onboarding_attention.length,
        governance_attention: governance_attention.length,
        limit_attention: limit_attention.length,
        trial_clients: [...subscriptionMap.values()].filter((subscription) => subscription.status === 'trial').length,
      },
      operational_metrics: {
        monitored_clients: clients.length,
        monitored_branches: branches.length,
        monitored_devices: await this.posDeviceRepository.count(),
        clients_with_sync_issues: sync_attention.length,
        failed_sync_events: syncTotals.failed,
        conflicted_sync_events: syncTotals.conflict,
        clients_with_failed_jobs: failed_jobs_attention.length,
        failed_job_count: failedSteps.length + failedAssignments.length,
        unhealthy_clients: client_health.length,
      },
      issue_summary,
      tenant_usage_summary: tenant_usage_summary.slice(0, 12),
      diagnostics_preview: diagnostics_preview.slice(0, 15),
      queues: {
        blocked_clients: blocked_clients.slice(0, 12),
        onboarding_attention: onboarding_attention.slice(0, 12),
        governance_attention: governance_attention.slice(0, 12),
        limit_attention: limit_attention.slice(0, 12),
        sync_attention: sync_attention.slice(0, 12),
        failed_jobs_attention: failed_jobs_attention.slice(0, 12),
        client_health: client_health.slice(0, 12),
      },
    };
  }

  async getIssuesSummary(): Promise<any> {
    const dashboard = await this.getDashboard();
    return {
      issue_summary: dashboard.issue_summary,
      operational_metrics: dashboard.operational_metrics,
      diagnostics_preview: dashboard.diagnostics_preview,
      queues: dashboard.queues,
    };
  }

  async getClientSummary(clientId: string): Promise<any> {
    const [client, currentSubscription, subscriptions, onboarding, entitlements, governance, governanceHistory, inspection, blueprintAssignment, blueprintHistory, branchCount, totalUserCount, diagnostics] =
      await Promise.all([
        this.clientsService.findOne(clientId),
        this.clientsService.getCurrentSubscription(clientId),
        this.clientsService.getSubscriptions(clientId),
        this.onboardingService.getClientOnboarding(clientId),
        this.entitlementsService.getEffectiveEntitlements(clientId),
        this.clientGovernanceService.getGovernance(clientId),
        this.clientGovernanceService.getGovernanceHistory(clientId),
        this.clientsService.getTenantInspection(clientId),
        this.blueprintsService.getClientBlueprintAssignment(clientId),
        this.blueprintsService.getClientBlueprintHistory(clientId),
        this.branchRepository.count({ where: { client_id: clientId } as any }),
        this.userRepository.count({ where: { client_id: clientId } }),
        this.getClientDiagnostics(clientId),
      ]);

    const blockers = this.buildBlockers(onboarding, entitlements, governance);
    const health = this.buildClientHealth(blockers, inspection, diagnostics, governance, entitlements);

    return {
      identity: {
        id: client.id,
        client_code: client.client_code,
        client_name: client.client_name,
        legal_name: client.legal_name,
        short_name: client.short_name,
        domain_slug: client.domain_slug,
        business_type: client.business_type,
        status: client.status,
        branch_count: branchCount,
        user_count: totalUserCount,
        contacts: Array.isArray(client.contacts) ? client.contacts : [],
        created_at: client.created_at,
        updated_at: client.updated_at,
      },
      subscription: {
        current: currentSubscription,
        history: Array.isArray(subscriptions) ? subscriptions.slice(0, 10) : [],
      },
      onboarding: {
        summary: onboarding?.onboarding || null,
        readiness: onboarding?.readiness || null,
        steps: Array.isArray(onboarding?.steps) ? onboarding.steps : [],
        events: Array.isArray(onboarding?.events) ? onboarding.events.slice(0, 12) : [],
      },
      entitlements,
      governance: {
        summary: governance,
        history: Array.isArray(governanceHistory) ? governanceHistory.slice(0, 10) : [],
      },
      inspection,
      blueprint: {
        current_assignment: blueprintAssignment?.current_assignment || null,
        history: Array.isArray(blueprintHistory) ? blueprintHistory.slice(0, 10) : [],
      },
      blockers,
      health,
      usage_summary: this.buildUsageRows(entitlements),
      diagnostics_summary: diagnostics.summary,
      recent_activity: this.buildRecentActivity(client, onboarding, governanceHistory, subscriptions, blueprintHistory),
    };
  }

  async getClientDiagnostics(clientId: string): Promise<any> {
    const client = await this.clientRepository.findOne({ where: buildClientLookupWhere(clientId) });
    if (!client) {
      return null;
    }
    const tenantKey = client.client_code;
    const branches = await this.branchRepository.find({ where: { client_id: tenantKey } as any, order: { branch_name: 'ASC' } });
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
    const branchIds = branches.map((branch) => branch.id);

    const [devices, syncStatusRows, syncEvents, failedSteps, failedAssignments, failedBlueprintLogs, auditSnapshot, auditSignals] =
      await Promise.all([
        this.posDeviceRepository.find({ where: { client_id: tenantKey } as any, order: { updated_at: 'DESC', id: 'DESC' } }),
        branchIds.length === 0
          ? []
          : this.posSyncEventRepository.createQueryBuilder('event')
            .select('event.status', 'status')
            .addSelect('COUNT(event.id)', 'total')
            .where('event.client_id = :clientId', { clientId })
            .andWhere('event.branch_id IN (:...branchIds)', { branchIds })
            .groupBy('event.status')
            .getRawMany<{ status: string; total: string }>(),
        branchIds.length === 0
          ? []
          : this.posSyncEventRepository.find({
            where: { client_id: clientId, branch_id: In(branchIds) as any, status: In(['failed', 'conflict']) as any },
            relations: ['device', 'branch'],
            order: { created_at: 'DESC', id: 'DESC' },
            take: 20,
          }),
        this.onboardingStepRepository.find({
          where: { client_id: clientId, status: In(['failed', 'blocked']) as any },
          order: { updated_at: 'DESC', id: 'DESC' },
          take: 15,
        }),
        this.blueprintAssignmentRepository.find({
          where: { client_id: clientId, assignment_status: 'failed' as any },
          relations: ['blueprint'],
          order: { updated_at: 'DESC', id: 'DESC' },
          take: 10,
        }),
        this.blueprintLogRepository.find({
          where: { client_id: clientId, result_status: 'failed' as any },
          relations: ['blueprint'],
          order: { created_at: 'DESC', id: 'DESC' },
          take: 10,
        }),
        this.auditService.getClientAuditSnapshot(clientId),
        this.auditLogRepository.createQueryBuilder('audit')
          .where('audit.client_id = :clientId', { clientId })
          .andWhere('audit.status IN (:...statuses)', { statuses: ['warning', 'error'] })
          .orderBy('audit.timestamp', 'DESC')
          .addOrderBy('audit.id', 'DESC')
          .take(12)
          .getMany(),
      ]);

    const syncTotals = { pending: 0, processed: 0, failed: 0, conflict: 0 };
    for (const row of syncStatusRows) {
      const key = String(row.status || '').toLowerCase() as keyof typeof syncTotals;
      if (key in syncTotals) syncTotals[key] = Number(row.total || 0);
    }

    const serializedDevices = devices.map((device) => ({
      id: device.id,
      branch_id: device.branch_id,
      branch_name: branchMap.get(device.branch_id)?.branch_name ?? null,
      device_uid: device.device_uid,
      device_code: device.device_code,
      device_name: device.device_name,
      device_type: device.device_type,
      status: device.status,
      last_seen_at: device.last_seen_at ?? null,
      last_sync_at: device.last_sync_at ?? null,
      last_sync_status: device.last_sync_status ?? 'idle',
      last_sync_message: device.last_sync_message ?? null,
    }));

    return {
      summary: {
        client_id: clientId,
        sync_issue_count: syncTotals.failed + syncTotals.conflict,
        device_issue_count: serializedDevices.filter((device) => ['failed', 'conflict'].includes(device.last_sync_status)).length,
        failed_job_count: failedSteps.length + failedAssignments.length + failedBlueprintLogs.length,
        audit_warning_count: Number(auditSnapshot.warning_events || 0),
        audit_error_count: Number(auditSnapshot.error_events || 0),
        open_issue_count: syncTotals.failed + syncTotals.conflict + failedSteps.length + failedAssignments.length + failedBlueprintLogs.length + Number(auditSnapshot.error_events || 0),
      },
      sync: {
        summary: {
          ...syncTotals,
          devices: serializedDevices.length,
          devices_with_issues: serializedDevices.filter((device) => ['failed', 'conflict'].includes(device.last_sync_status)).length,
          last_processed_at: (syncEvents as PosSyncEvent[]).find((event) => event.processed_at)?.processed_at ?? null,
        },
        devices: serializedDevices,
        recent_failures: syncEvents.map((event) => ({
          id: event.id,
          branch_id: event.branch_id,
          branch_name: branchMap.get(event.branch_id)?.branch_name ?? event.branch?.branch_name ?? null,
          device_name: event.device?.device_name || event.device?.device_code || event.device?.device_uid || null,
          entity_type: event.entity_type,
          entity_id: event.entity_id,
          status: event.status,
          event_type: event.event_type,
          attempt_count: Number(event.attempt_count || 0),
          error_message: event.error_message ?? null,
          created_at: event.created_at,
          last_attempt_at: event.last_attempt_at ?? null,
        })),
      },
      jobs: {
        summary: {
          onboarding_failures: failedSteps.length,
          blueprint_failures: failedAssignments.length + failedBlueprintLogs.length,
        },
        failed_items: [
          ...failedSteps.map((step) => ({
            type: 'onboarding_step',
            key: step.step_key,
            name: step.step_name,
            status: step.status,
            message: step.last_error || step.notes || 'Step requires follow-up',
            attempt_count: Number(step.attempt_count || 0),
            timestamp: step.updated_at,
          })),
          ...failedAssignments.map((assignment) => ({
            type: 'blueprint_assignment',
            key: assignment.blueprint_id,
            name: assignment.blueprint?.blueprint_name || 'Blueprint assignment',
            status: assignment.assignment_status,
            message: assignment.failure_summary || 'Blueprint application failed',
            attempt_count: null,
            timestamp: assignment.updated_at,
          })),
          ...failedBlueprintLogs.map((log) => ({
            type: 'blueprint_log',
            key: log.section_key,
            name: log.blueprint?.blueprint_name || 'Blueprint log',
            status: log.result_status,
            message: log.message,
            attempt_count: null,
            timestamp: log.created_at,
          })),
        ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()),
      },
      audit: {
        snapshot: auditSnapshot,
        recent_signals: auditSignals.map((signal) => ({
          id: signal.id,
          portal: signal.portal,
          status: signal.status,
          action: signal.action,
          entity: signal.entity,
          details: signal.details,
          request_path: signal.requestPath,
          request_method: signal.requestMethod,
          timestamp: signal.timestamp,
        })),
      },
      recent_issues: this.buildClientIssueTimeline(client, syncEvents, failedSteps, failedAssignments, failedBlueprintLogs, auditSignals, branchMap),
    };
  }

  private buildCurrentSubscriptionMap(subscriptions: ClientSubscription[]): Map<string, ClientSubscription> {
    const grouped = new Map<string, ClientSubscription[]>();
    for (const subscription of subscriptions) {
      const current = grouped.get(subscription.client_id) || [];
      current.push(subscription);
      grouped.set(subscription.client_id, current);
    }

    const priority = ['active', 'grace', 'trial', 'suspended', 'pending'];
    const result = new Map<string, ClientSubscription>();
    for (const [clientId, rows] of grouped.entries()) {
      let selected = rows[0];
      for (const status of priority) {
        const match = rows.find((row) => row.status === status);
        if (match) {
          selected = match;
          break;
        }
      }
      result.set(clientId, selected);
    }
    return result;
  }

  private createQueueItem(
    client: Client,
    subscription: ClientSubscription | null,
    severity: DashboardSeverity,
    reason: string,
    warnings?: string[],
  ): SupportQueueItem {
    return {
      client_id: client.client_code,
      client_code: client.client_code,
      client_name: client.client_name,
      client_status: client.status,
      governance_state: client.governance_state || 'normal',
      subscription_status: subscription?.status || null,
      current_plan_name: subscription?.plan_name_snapshot || null,
      severity,
      reason,
      warnings,
    };
  }

  private buildSyncQueue(
    events: PosSyncEvent[],
    devices: PosDevice[],
    clientMap: Map<string, Client>,
    subscriptionMap: Map<string, ClientSubscription>,
  ): SupportQueueItem[] {
    const issueMap = new Map<string, { failed: number; conflict: number; devices: number; latest: string | null }>();
    for (const event of events) {
      const current = issueMap.get(event.client_id) || { failed: 0, conflict: 0, devices: 0, latest: null };
      if (event.status === 'failed') current.failed += 1;
      if (event.status === 'conflict') current.conflict += 1;
      current.latest = current.latest || event.error_message || `${event.entity_type} sync ${event.status}`;
      issueMap.set(event.client_id, current);
    }
    for (const device of devices) {
      const current = issueMap.get(device.client_id) || { failed: 0, conflict: 0, devices: 0, latest: null };
      current.devices += 1;
      current.latest = current.latest || device.last_sync_message || 'Device sync health requires review';
      issueMap.set(device.client_id, current);
    }

    return ([...issueMap.entries()]
      .map(([clientId, issue]) => {
        const client = clientMap.get(clientId);
        if (!client) return null;
        return {
          ...this.createQueueItem(client, subscriptionMap.get(clientId) || null, issue.conflict > 0 || issue.failed > 0 ? 'critical' : 'warning', issue.latest || 'Sync issues require support follow-up'),
          issue_count: issue.failed + issue.conflict + issue.devices,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b.issue_count || 0) - (a.issue_count || 0))) as SupportQueueItem[];
  }

  private buildFailedJobQueue(
    steps: ClientOnboardingStep[],
    assignments: ClientBlueprintAssignment[],
    clientMap: Map<string, Client>,
    subscriptionMap: Map<string, ClientSubscription>,
  ): SupportQueueItem[] {
    const issueMap = new Map<string, { count: number; message: string }>();
    for (const step of steps) {
      const current = issueMap.get(step.client_id) || { count: 0, message: step.last_error || `${step.step_name} requires follow-up` };
      current.count += 1;
      issueMap.set(step.client_id, current);
    }
    for (const assignment of assignments) {
      const current = issueMap.get(assignment.client_id) || { count: 0, message: assignment.failure_summary || 'Blueprint application failed' };
      current.count += 1;
      issueMap.set(assignment.client_id, current);
    }

    return ([...issueMap.entries()]
      .map(([clientId, issue]) => {
        const client = clientMap.get(clientId);
        if (!client) return null;
        return {
          ...this.createQueueItem(client, subscriptionMap.get(clientId) || null, 'critical', issue.message),
          issue_count: issue.count,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b.issue_count || 0) - (a.issue_count || 0))) as SupportQueueItem[];
  }

  private buildUsageSummary(clients: Client[], subscriptionMap: Map<string, ClientSubscription>, entitlementsMap: Map<string, any>) {
    return clients
      .map((client) => {
        const entitlements = entitlementsMap.get(client.client_code);
        const usage = this.buildUsageRows(entitlements);
        const highest = usage.reduce((max, row) => Math.max(max, row.percent ?? 0), 0);
        if (highest < 50 && !(entitlements?.warnings || []).length) return null;
        return {
          client_id: client.client_code,
          client_code: client.client_code,
          client_name: client.client_name,
          client_status: client.status,
          current_plan_name: entitlements?.current_plan_name || subscriptionMap.get(client.client_code)?.plan_name_snapshot || null,
          severity: highest >= 100 ? 'critical' : highest >= 80 || (entitlements?.warnings || []).length ? 'warning' : 'info',
          reason: (entitlements?.warnings || [])[0] || `Highest tracked usage is ${Math.round(highest)}% of limit`,
          highest_usage_percent: Math.round(highest),
          usage,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.highest_usage_percent - a.highest_usage_percent);
  }

  private buildUsageRows(entitlements: any) {
    return [
      this.buildUsageRow('max_branches', 'Branches', entitlements),
      this.buildUsageRow('max_active_users', 'Active Users', entitlements),
      this.buildUsageRow('max_pos_devices', 'POS Devices', entitlements),
    ];
  }

  private buildUsageRow(key: string, label: string, entitlements: any) {
    const used = Number(entitlements?.usage?.[key] ?? 0);
    const rawLimit = entitlements?.limits?.[key];
    const limit = rawLimit === null || rawLimit === undefined ? null : Number(rawLimit);
    return {
      key,
      label,
      used,
      limit,
      percent: limit && limit > 0 ? Math.round((used / limit) * 10000) / 100 : null,
    };
  }

  private buildHealthQueue(
    clients: Client[],
    blocked: SupportQueueItem[],
    governance: SupportQueueItem[],
    limits: SupportQueueItem[],
    onboarding: SupportQueueItem[],
    sync: SupportQueueItem[],
    jobs: SupportQueueItem[],
  ) {
    const severityWeight: Record<DashboardSeverity, number> = { info: 1, warning: 2, critical: 3 };
    const signalMap = new Map<string, SupportQueueItem[]>();
    for (const group of [blocked, governance, limits, onboarding, sync, jobs]) {
      for (const item of group) {
        const current = signalMap.get(item.client_id) || [];
        current.push(item);
        signalMap.set(item.client_id, current);
      }
    }

    return (clients
      .map((client) => {
        const signals = signalMap.get(client.client_code) || [];
        if (!signals.length) return null;
        const primary = [...signals].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])[0];
        return {
          ...this.createQueueItem(client, null, primary.severity, primary.reason),
          issue_count: signals.length,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => severityWeight[b.severity] - severityWeight[a.severity] || (b.issue_count || 0) - (a.issue_count || 0))) as SupportQueueItem[];
  }

  private buildDiagnosticsPreview(
    syncEvents: PosSyncEvent[],
    failedSteps: ClientOnboardingStep[],
    failedAssignments: ClientBlueprintAssignment[],
    auditSignals: AuditLog[],
    clientMap: Map<string, Client>,
    branchMap: Map<number, Branch>,
  ) {
    return [
      ...syncEvents.map((event) => ({
        client_id: event.client_id,
        client_code: clientMap.get(event.client_id)?.client_code || null,
        client_name: clientMap.get(event.client_id)?.client_name || event.client_id,
        source: 'sync',
        severity: event.status === 'conflict' ? 'critical' : 'warning',
        message: event.error_message || `${event.entity_type} sync ${event.status}`,
        timestamp: event.created_at,
        branch_name: branchMap.get(event.branch_id)?.branch_name ?? event.branch?.branch_name ?? null,
      })),
      ...failedSteps.map((step) => ({
        client_id: step.client_id,
        client_code: clientMap.get(step.client_id)?.client_code || null,
        client_name: clientMap.get(step.client_id)?.client_name || step.client_id,
        source: 'onboarding',
        severity: step.status === 'failed' ? 'critical' : 'warning',
        message: step.last_error || `${step.step_name} is ${step.status}`,
        timestamp: step.updated_at,
        branch_name: null,
      })),
      ...failedAssignments.map((assignment) => ({
        client_id: assignment.client_id,
        client_code: clientMap.get(assignment.client_id)?.client_code || null,
        client_name: clientMap.get(assignment.client_id)?.client_name || assignment.client_id,
        source: 'blueprint',
        severity: 'critical',
        message: assignment.failure_summary || 'Blueprint application failed',
        timestamp: assignment.updated_at,
        branch_name: null,
      })),
      ...auditSignals.filter((signal) => signal.clientId).map((signal) => ({
        client_id: signal.clientId as string,
        client_code: clientMap.get(signal.clientId as string)?.client_code || null,
        client_name: clientMap.get(signal.clientId as string)?.client_name || (signal.clientId as string),
        source: 'audit',
        severity: signal.status === 'error' ? 'critical' : 'warning',
        message: signal.details || `${signal.action} (${signal.status})`,
        timestamp: signal.timestamp,
        branch_name: signal.branchId ? branchMap.get(signal.branchId)?.branch_name ?? null : null,
      })),
    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  private buildBlockers(onboarding: any, entitlements: any, governance: any) {
    const blockers: Array<{ source: string; severity: DashboardSeverity; message: string }> = [];
    if (entitlements?.blocking_reason) blockers.push({ source: 'commercial', severity: 'critical', message: entitlements.blocking_reason });
    for (const warning of entitlements?.warnings || []) blockers.push({ source: 'limits', severity: warning.includes('limit reached') ? 'critical' : 'warning', message: warning });
    if (governance?.governance_state && governance.governance_state !== 'normal') blockers.push({ source: 'governance', severity: ['suspended', 'closure_pending', 'closed'].includes(governance.governance_state) ? 'critical' : 'warning', message: governance.reason || `Governance state is ${governance.governance_state}` });
    for (const blocker of onboarding?.readiness?.blockers || []) blockers.push({ source: 'onboarding', severity: 'warning', message: blocker });
    return blockers.filter((item, index, self) => self.findIndex((entry) => entry.source === item.source && entry.message === item.message) === index);
  }

  private buildClientHealth(blockers: Array<{ source: string; severity: DashboardSeverity; message: string }>, inspection: any, diagnostics: any, governance: any, entitlements: any) {
    const indicators = [...blockers];
    for (const finding of inspection?.findings || []) indicators.push({ source: 'tenant_isolation', severity: finding.severity, message: finding.message });
    if (Number(diagnostics?.summary?.sync_issue_count || 0) > 0) indicators.push({ source: 'offline_sync', severity: 'critical', message: `${diagnostics.summary.sync_issue_count} sync issue(s) need support follow-up` });
    if (Number(diagnostics?.summary?.failed_job_count || 0) > 0) indicators.push({ source: 'operational_jobs', severity: 'critical', message: `${diagnostics.summary.failed_job_count} failed operational job(s) are still open` });
    if (Number(diagnostics?.summary?.audit_error_count || 0) > 0) indicators.push({ source: 'audit_errors', severity: 'warning', message: `${diagnostics.summary.audit_error_count} audit error event(s) were recorded in the last 7 days` });
    if ((governance?.governance_state || 'normal') !== 'normal') indicators.push({ source: 'governance', severity: ['suspended', 'closure_pending', 'closed'].includes(governance.governance_state) ? 'critical' : 'warning', message: governance.reason || `Governance state is ${governance.governance_state}` });
    if ((entitlements?.warnings || []).length) indicators.push({ source: 'commercial', severity: (entitlements.warnings || []).some((warning: string) => warning.includes('limit reached')) ? 'critical' : 'warning', message: entitlements.warnings[0] });
    const deduped = indicators.filter((item, index, self) => self.findIndex((entry) => entry.source === item.source && entry.message === item.message) === index);
    const status: HealthStatus = deduped.some((item) => item.severity === 'critical') ? 'critical' : deduped.length || inspection?.health_status === 'warning' ? 'warning' : 'healthy';
    const score = status === 'healthy' ? 100 : status === 'warning' ? Math.max(55, 100 - deduped.length * 8) : Math.max(20, 70 - deduped.length * 10);
    return { status, score, indicators: deduped.slice(0, 12) };
  }

  private buildRecentActivity(client: any, onboarding: any, governanceHistory: any[], subscriptions: any[], blueprintHistory: any[]) {
    const activity: Array<{ source: string; type: string; message: string; timestamp: string | Date | null }> = [];
    for (const entry of client?.recent_status_history?.slice?.(0, 5) || []) activity.push({ source: 'lifecycle', type: 'status_transition', message: `${entry.from_status || 'created'} -> ${entry.to_status}: ${entry.reason}`, timestamp: entry.created_at });
    for (const event of onboarding?.events?.slice?.(0, 6) || []) activity.push({ source: 'onboarding', type: event.event_type, message: event.message, timestamp: event.created_at });
    for (const entry of governanceHistory?.slice?.(0, 5) || []) activity.push({ source: 'governance', type: entry.action_type, message: `${entry.from_state || 'normal'} -> ${entry.to_state}: ${entry.reason}`, timestamp: entry.created_at });
    for (const entry of subscriptions || []) for (const history of entry.history || []) activity.push({ source: 'subscription', type: history.action_type, message: history.reason || `${history.action_type} on ${entry.plan_name}`, timestamp: history.created_at });
    for (const entry of blueprintHistory?.slice?.(0, 4) || []) activity.push({ source: 'blueprint', type: entry.assignment_status, message: `${entry.blueprint_name || 'Blueprint'} v${entry.version_no || '?'} ${entry.assignment_status}`, timestamp: entry.updated_at || entry.created_at });
    return activity.filter((entry) => entry.timestamp).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 12);
  }

  private buildClientIssueTimeline(
    client: Client | null,
    syncEvents: PosSyncEvent[],
    failedSteps: ClientOnboardingStep[],
    failedAssignments: ClientBlueprintAssignment[],
    failedBlueprintLogs: BlueprintApplicationLog[],
    auditSignals: AuditLog[],
    branchMap: Map<number, Branch>,
  ) {
    if (!client) return [];
    return [
      ...syncEvents.map((event) => ({ client_id: client.client_code, client_code: client.client_code, client_name: client.client_name, source: 'sync', severity: event.status === 'conflict' ? 'critical' : 'warning', message: event.error_message || `${event.entity_type} sync ${event.status}`, timestamp: event.created_at, branch_name: branchMap.get(event.branch_id)?.branch_name ?? event.branch?.branch_name ?? null })),
      ...failedSteps.map((step) => ({ client_id: client.client_code, client_code: client.client_code, client_name: client.client_name, source: 'onboarding', severity: step.status === 'failed' ? 'critical' : 'warning', message: step.last_error || `${step.step_name} is ${step.status}`, timestamp: step.updated_at, branch_name: null })),
      ...failedAssignments.map((assignment) => ({ client_id: client.client_code, client_code: client.client_code, client_name: client.client_name, source: 'blueprint', severity: 'critical', message: assignment.failure_summary || 'Blueprint assignment failed', timestamp: assignment.updated_at, branch_name: null })),
      ...failedBlueprintLogs.map((log) => ({ client_id: client.client_code, client_code: client.client_code, client_name: client.client_name, source: 'blueprint', severity: 'critical', message: log.message, timestamp: log.created_at, branch_name: null })),
      ...auditSignals.map((signal) => ({ client_id: client.client_code, client_code: client.client_code, client_name: client.client_name, source: 'audit', severity: signal.status === 'error' ? 'critical' : 'warning', message: signal.details || `${signal.action} (${signal.status})`, timestamp: signal.timestamp, branch_name: signal.branchId ? branchMap.get(signal.branchId)?.branch_name ?? null : null })),
    ].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 20);
  }
}
