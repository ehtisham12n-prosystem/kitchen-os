import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

type AuditScope = {
    isSystem?: boolean;
    clientId?: string;
    accessibleBranchIds?: number[];
    requestedBranchId?: number;
};

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditLog)
        private repo: Repository<AuditLog>,
    ) { }

    async findAll(query: QueryAuditLogsDto = {}, scope: AuditScope = {}) {
        const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
        const offset = Math.max(query.offset ?? 0, 0);
        const qb = this.repo.createQueryBuilder('audit');

        this.applyScope(qb, scope);

        if (query.search?.trim()) {
            const search = `%${query.search.trim()}%`;
            qb.andWhere(new Brackets((subQuery) => {
                subQuery
                    .where('audit.user_name LIKE :search', { search })
                    .orWhere('audit.UserManagement_role LIKE :search', { search })
                    .orWhere('audit.action LIKE :search', { search })
                    .orWhere('audit.entity LIKE :search', { search })
                    .orWhere('audit.details LIKE :search', { search })
                    .orWhere('audit.client_id LIKE :search', { search })
                    .orWhere('audit.request_path LIKE :search', { search });
            }));
        }

        if (query.portal) {
            qb.andWhere('audit.portal = :portal', { portal: query.portal });
        }
        if (query.status) {
            qb.andWhere('audit.status = :status', { status: query.status });
        }
        if (query.client_id) {
            qb.andWhere('audit.client_id = :clientId', { clientId: query.client_id });
        }
        if (query.branch_id) {
            qb.andWhere('audit.branch_id = :branchId', { branchId: query.branch_id });
        }
        if (query.action?.trim()) {
            qb.andWhere('audit.action LIKE :action', { action: `%${query.action.trim()}%` });
        }
        if (query.entity?.trim()) {
            qb.andWhere('audit.entity LIKE :entity', { entity: `%${query.entity.trim()}%` });
        }
        if (query.actor_type?.trim()) {
            qb.andWhere('audit.actor_type = :actorType', { actorType: query.actor_type.trim() });
        }
        if (query.date_from) {
            qb.andWhere('audit.timestamp >= :dateFrom', { dateFrom: query.date_from });
        }
        if (query.date_to) {
            qb.andWhere('audit.timestamp <= :dateTo', { dateTo: query.date_to });
        }

        const listQb = qb.clone()
            .select([
                'audit.id',
                'audit.timestamp',
                'audit.userId',
                'audit.UserManagementName',
                'audit.UserManagementRole',
                'audit.actorType',
                'audit.clientId',
                'audit.branchId',
                'audit.entityId',
                'audit.requestMethod',
                'audit.requestPath',
                'audit.action',
                'audit.entity',
                'audit.portal',
                'audit.ipAddress',
                'audit.status',
                'audit.details',
            ])
            .orderBy('audit.timestamp', 'DESC')
            .addOrderBy('audit.id', 'DESC')
            .take(limit)
            .skip(offset);

        const [items, total, summary] = await Promise.all([
            listQb.getMany(),
            qb.clone().getCount(),
            this.buildSummary(qb),
        ]);

        return {
            items,
            total,
            limit,
            offset,
            has_more: offset + items.length < total,
            summary,
        };
    }

    async findById(id: string, scope: AuditScope = {}) {
        const qb = this.repo.createQueryBuilder('audit')
            .where('audit.id = :id', { id });
        this.applyScope(qb, scope);

        const log = await qb.getOne();
        if (!log) throw new NotFoundException('Audit log not found');
        return log;
    }

    async createLog(logData: Partial<AuditLog>) {
        const metadata = this.parseJson(logData.metadataJson);
        const normalizedData: Partial<AuditLog> = {
            ...logData,
            actorType: logData.actorType ?? this.toNullableString(metadata?.actor_type),
            clientId: logData.clientId ?? this.toNullableString(metadata?.client_id),
            branchId: logData.branchId ?? this.toNullableNumber(metadata?.branch_id),
            entityId: logData.entityId ?? this.toNullableString(metadata?.entity_id),
            requestMethod: logData.requestMethod ?? this.toNullableString(metadata?.request_method ?? metadata?.method),
            requestPath: logData.requestPath ?? this.toNullableString(metadata?.request_path ?? metadata?.url ?? metadata?.endpoint),
        };
        const log = this.repo.create(normalizedData);
        return this.repo.save(log);
    }

    async findByClientId(clientId: string, limit: number = 50) {
        return this.repo.createQueryBuilder('audit')
            .where('audit.client_id = :clientId', { clientId })
            .orderBy('audit.timestamp', 'DESC')
            .take(limit)
            .getMany();
    }

    async getClientAuditSnapshot(clientId: string, days: number = 7): Promise<{
        client_id: string;
        window_days: number;
        total_events: number;
        warning_events: number;
        error_events: number;
        write_events: number;
        last_event_at: Date | null;
        portals: Array<{ portal: string; total: number }>;
    }> {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const [totals, portalRows] = await Promise.all([
            this.repo.createQueryBuilder('audit')
                .select('COUNT(*)', 'total_events')
                .addSelect("SUM(CASE WHEN audit.status = 'warning' THEN 1 ELSE 0 END)", 'warning_events')
                .addSelect("SUM(CASE WHEN audit.status = 'error' THEN 1 ELSE 0 END)", 'error_events')
                .addSelect("SUM(CASE WHEN audit.request_method IN ('POST', 'PUT', 'PATCH', 'DELETE') THEN 1 ELSE 0 END)", 'write_events')
                .addSelect('MAX(audit.timestamp)', 'last_event_at')
                .where('audit.client_id = :clientId', { clientId })
                .andWhere('audit.timestamp >= :since', { since })
                .getRawOne<{
                    total_events: string;
                    warning_events: string | null;
                    error_events: string | null;
                    write_events: string | null;
                    last_event_at: Date | null;
                }>(),
            this.repo.createQueryBuilder('audit')
                .select('audit.portal', 'portal')
                .addSelect('COUNT(*)', 'total')
                .where('audit.client_id = :clientId', { clientId })
                .andWhere('audit.timestamp >= :since', { since })
                .groupBy('audit.portal')
                .orderBy('total', 'DESC')
                .getRawMany<{ portal: string; total: string }>(),
        ]);

        return {
            client_id: clientId,
            window_days: days,
            total_events: Number(totals?.total_events || 0),
            warning_events: Number(totals?.warning_events || 0),
            error_events: Number(totals?.error_events || 0),
            write_events: Number(totals?.write_events || 0),
            last_event_at: totals?.last_event_at || null,
            portals: portalRows.map((row) => ({
                portal: row.portal,
                total: Number(row.total || 0),
            })),
        };
    }

    async seed() {
        // Security-facing audit views should not be backfilled with mock events.
        return;
    }

    private async buildSummary(baseQb: ReturnType<Repository<AuditLog>['createQueryBuilder']>) {
        const summaryQb = baseQb.clone();
        const raw = await summaryQb
            .select('COUNT(*)', 'total')
            .addSelect("SUM(CASE WHEN audit.status = 'success' THEN 1 ELSE 0 END)", 'success_count')
            .addSelect("SUM(CASE WHEN audit.status = 'warning' THEN 1 ELSE 0 END)", 'warning_count')
            .addSelect("SUM(CASE WHEN audit.status = 'error' THEN 1 ELSE 0 END)", 'error_count')
            .addSelect("SUM(CASE WHEN audit.request_method IN ('POST', 'PUT', 'PATCH', 'DELETE') THEN 1 ELSE 0 END)", 'write_count')
            .addSelect('MAX(audit.timestamp)', 'last_event_at')
            .getRawOne<{
                total: string;
                success_count: string | null;
                warning_count: string | null;
                error_count: string | null;
                write_count: string | null;
                last_event_at: Date | null;
            }>();

        return {
            total: Number(raw?.total || 0),
            success_count: Number(raw?.success_count || 0),
            warning_count: Number(raw?.warning_count || 0),
            error_count: Number(raw?.error_count || 0),
            write_count: Number(raw?.write_count || 0),
            last_event_at: raw?.last_event_at || null,
        };
    }

    private parseJson(value?: string | null): Record<string, unknown> | null {
        if (!value) {
            return null;
        }

        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
        } catch {
            return null;
        }
    }

    private toNullableString(value: unknown): string | null {
        if (value === undefined || value === null || value === '') {
            return null;
        }

        return String(value);
    }

    private toNullableNumber(value: unknown): number | null {
        if (value === undefined || value === null || value === '') {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private applyScope(
        qb: ReturnType<Repository<AuditLog>['createQueryBuilder']>,
        scope: AuditScope,
    ) {
        if (scope.isSystem) {
            return;
        }

        if (scope.clientId) {
            qb.andWhere('audit.client_id = :scopeClientId', { scopeClientId: scope.clientId });
        }

        if (scope.requestedBranchId) {
            qb.andWhere('audit.branch_id = :scopeRequestedBranchId', {
                scopeRequestedBranchId: scope.requestedBranchId,
            });
            return;
        }

        if (scope.accessibleBranchIds && scope.accessibleBranchIds.length > 0) {
            qb.andWhere(
                new Brackets((subQuery) => {
                    subQuery
                        .where('audit.branch_id IS NULL')
                        .orWhere('audit.branch_id IN (:...scopeAccessibleBranchIds)', {
                            scopeAccessibleBranchIds: scope.accessibleBranchIds,
                        });
                }),
            );
        }
    }
}
