import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { accessSync, constants } from 'fs';
import { DataSource } from 'typeorm';
import { SupportWorkspaceService } from '../support-workspace/support-workspace.service';
import { getBooleanEnv, getNodeEnv, getOptionalEnv } from '../../config/env.config';

type ReliabilityStatus = 'healthy' | 'warning' | 'critical';
type MonitorStatus = 'optimal' | 'warning' | 'degraded';

@Injectable()
export class OperationalReliabilityService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly supportWorkspaceService: SupportWorkspaceService,
  ) {}

  async getLiveness() {
    return {
      status: 'ok',
      service: 'KitchenOS API',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
    };
  }

  async getReadiness() {
    const database = await this.checkDatabase();
    const status = database.status === 'healthy' ? 'ready' : 'degraded';

    return {
      status,
      service: 'KitchenOS API',
      timestamp: new Date().toISOString(),
      checks: {
        database,
      },
    };
  }

  async getOperationalSnapshot() {
    const [database, supportDashboard] = await Promise.all([
      this.checkDatabase(),
      this.supportWorkspaceService.getDashboard(),
    ]);

    const metrics = supportDashboard?.operational_metrics || {};
    const issueSummary = supportDashboard?.issue_summary || {};
    const diagnosticsPreview = Array.isArray(supportDashboard?.diagnostics_preview)
      ? supportDashboard.diagnostics_preview
      : [];
    const backup = this.buildBackupReadiness();
    const uptimeSeconds = Math.round(process.uptime());
    const totalClients = Number(metrics.monitored_clients || 0);
    const failedSyncEvents = Number(metrics.failed_sync_events || 0);
    const syncConflicts = Number(metrics.conflicted_sync_events || 0);
    const failedJobs = Number(metrics.failed_job_count || 0);
    const unhealthyClients = Number(metrics.unhealthy_clients || 0);
    const openIssues = Number(issueSummary.open_issues || 0);

    const services = [
      {
        name: 'API Runtime',
        status: 'optimal' as MonitorStatus,
        latency: 'live',
        uptime: `${uptimeSeconds}s`,
        load: this.normalizePercent(process.memoryUsage().rss / (1024 * 1024 * 512) * 100),
        detail: `PID ${process.pid} serving requests`,
      },
      {
        name: 'MySQL Connectivity',
        status: this.toMonitorStatus(database.status),
        latency: database.latency_ms !== null ? `${database.latency_ms} ms` : 'unavailable',
        uptime: database.detail,
        load: database.latency_ms !== null ? this.normalizePercent((database.latency_ms / 400) * 100) : 100,
        detail: database.detail,
      },
      {
        name: 'Offline POS Sync',
        status: this.toMonitorStatus(
          failedSyncEvents + syncConflicts >= 5 ? 'critical' : failedSyncEvents + syncConflicts > 0 ? 'warning' : 'healthy',
        ),
        latency: `${Number(metrics.monitored_devices || 0)} devices`,
        uptime: `${Math.max(0, Number(metrics.monitored_devices || 0) - failedSyncEvents - syncConflicts)} stable`,
        load: Number(metrics.monitored_devices || 0) > 0
          ? this.normalizePercent(((failedSyncEvents + syncConflicts) / Number(metrics.monitored_devices || 1)) * 100)
          : 0,
        detail: `${failedSyncEvents} failed and ${syncConflicts} conflicted sync events currently need follow-up`,
      },
      {
        name: 'Operational Jobs',
        status: this.toMonitorStatus(failedJobs >= 4 ? 'critical' : failedJobs > 0 ? 'warning' : 'healthy'),
        latency: `${failedJobs} open`,
        uptime: `${Number(metrics.clients_with_failed_jobs || 0)} tenant(s) impacted`,
        load: this.normalizePercent(failedJobs * 18),
        detail: `${failedJobs} onboarding or blueprint job failure(s) are still unresolved`,
      },
      {
        name: 'Tenant Attention',
        status: this.toMonitorStatus(unhealthyClients >= 3 ? 'critical' : unhealthyClients > 0 ? 'warning' : 'healthy'),
        latency: `${unhealthyClients} unhealthy`,
        uptime: `${Math.max(0, totalClients - unhealthyClients)} stable`,
        load: totalClients > 0 ? this.normalizePercent((unhealthyClients / totalClients) * 100) : 0,
        detail: `${openIssues} open operational issue(s) across ${totalClients} monitored tenants`,
      },
    ];

    const overallStatus = this.pickOverallStatus([
      database.status,
      backup.status,
      failedJobs >= 4 || failedSyncEvents + syncConflicts >= 5 || unhealthyClients >= 3
        ? 'critical'
        : failedJobs > 0 || failedSyncEvents + syncConflicts > 0 || unhealthyClients > 0
          ? 'warning'
          : 'healthy',
    ]);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'KitchenOS API',
      environment: getNodeEnv(),
      uptime_seconds: uptimeSeconds,
      summary: {
        monitored_clients: totalClients,
        monitored_branches: Number(metrics.monitored_branches || 0),
        monitored_devices: Number(metrics.monitored_devices || 0),
        open_issues: openIssues,
        failed_sync_events: failedSyncEvents,
        sync_conflicts: syncConflicts,
        failed_job_count: failedJobs,
        unhealthy_clients: unhealthyClients,
      },
      services,
      checks: {
        database,
        backup,
      },
      incidents: diagnosticsPreview.slice(0, 8),
    };
  }

  private async checkDatabase(): Promise<{
    status: ReliabilityStatus;
    detail: string;
    latency_ms: number | null;
  }> {
    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1 AS ok');
      return {
        status: 'healthy',
        detail: 'Database connection is ready',
        latency_ms: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'critical',
        detail: error instanceof Error ? error.message : 'Database query failed',
        latency_ms: null,
      };
    }
  }

  private buildBackupReadiness(): {
    status: ReliabilityStatus;
    detail: string;
    storage_path: string | null;
    retention_days: number | null;
    restore_validation_enabled: boolean;
    notes: string[];
  } {
    const storagePath = getOptionalEnv('BACKUP_STORAGE_PATH') ?? null;
    const retentionDays = this.parsePositiveNumber(getOptionalEnv('BACKUP_RETENTION_DAYS'));
    const restoreValidationEnabled = getBooleanEnv(
      'BACKUP_RESTORE_VALIDATION_ENABLED',
      false,
    );
    const notes: string[] = [];
    let accessible = false;

    if (!storagePath) {
      notes.push('BACKUP_STORAGE_PATH is not configured.');
    } else {
      try {
        accessSync(storagePath, constants.R_OK);
        accessible = true;
      } catch {
        notes.push('Configured backup storage path is not readable by the API process.');
      }
    }

    if (!retentionDays) {
      notes.push('BACKUP_RETENTION_DAYS is not configured.');
    }

    if (!restoreValidationEnabled) {
      notes.push('Restore validation hook is disabled.');
    }

    const status: ReliabilityStatus = notes.length === 0
      ? 'healthy'
      : accessible || restoreValidationEnabled
        ? 'warning'
        : 'critical';

    return {
      status,
      detail: notes.length === 0 ? 'Backup configuration hooks are ready' : notes[0],
      storage_path: storagePath,
      retention_days: retentionDays,
      restore_validation_enabled: restoreValidationEnabled,
      notes,
    };
  }

  private parsePositiveNumber(value?: string | null) {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private toMonitorStatus(status: ReliabilityStatus): MonitorStatus {
    if (status === 'critical') return 'degraded';
    if (status === 'warning') return 'warning';
    return 'optimal';
  }

  private pickOverallStatus(statuses: ReliabilityStatus[]): ReliabilityStatus {
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  private normalizePercent(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
