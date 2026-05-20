import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionOrder } from '../entities/subscription-order.entity';
import { UserManagement } from '../../setup/entities/UserManagement.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { ClientSubscription } from '../entities/client-subscription.entity';
import { OnboardingService } from '../onboarding/onboarding.service';
import { SupportWorkspaceService } from '../support-workspace/support-workspace.service';
import { OperationalReliabilityService } from '../reliability/operational-reliability.service';

@Injectable()
export class PlatformDashboardService {
    constructor(
        @InjectRepository(Client)
        private clientRepo: Repository<Client>,
        @InjectRepository(Branch)
        private branchRepo: Repository<Branch>,
        @InjectRepository(SubscriptionOrder)
        private orderRepo: Repository<SubscriptionOrder>,
        @InjectRepository(UserManagement)
        private sysUserManagementRepo: Repository<UserManagement>,
        @InjectRepository(SubscriptionPlan)
        private planRepo: Repository<SubscriptionPlan>,
        @InjectRepository(ClientSubscription)
        private clientSubscriptionRepo: Repository<ClientSubscription>,
        private readonly onboardingService: OnboardingService,
        private readonly supportWorkspaceService: SupportWorkspaceService,
        private readonly operationalReliabilityService: OperationalReliabilityService,
    ) { }

    async getOverview() {
        const [clients, subscriptions, onboardingQueue, supportDashboard] = await Promise.all([
            this.clientRepo.find({
                relations: ['subscription_plan'],
                order: { updated_at: 'DESC' },
            }),
            this.clientSubscriptionRepo.find({
                relations: ['plan'],
                order: { effective_start_at: 'DESC', created_at: 'DESC' },
            }),
            this.onboardingService.listQueue(),
            this.supportWorkspaceService.getDashboard(),
        ]);

        const currentSubscriptionMap = this.buildCurrentSubscriptionMap(subscriptions);
        const onboardingRows = Array.isArray(onboardingQueue) ? onboardingQueue : [];
        const onboardingAttentionQueue = supportDashboard?.queues?.onboarding_attention || [];
        const expiringSubscriptions = this.collectExpiringSubscriptions(clients, currentSubscriptionMap);
        const planDistributionMap = new Map<string, number>();
        const subscriptionStateCounts = new Map<string, number>();
        let trialClients = 0;
        let retiredPlanClients = 0;

        for (const subscription of currentSubscriptionMap.values()) {
            const planName = subscription.plan_name_snapshot || subscription.plan?.plan_name || 'Unassigned';
            planDistributionMap.set(planName, (planDistributionMap.get(planName) || 0) + 1);
            subscriptionStateCounts.set(subscription.status, (subscriptionStateCounts.get(subscription.status) || 0) + 1);
            if (subscription.status === 'trial') {
                trialClients += 1;
            }
            if (subscription.plan?.plan_status === 'retired') {
                retiredPlanClients += 1;
            }
        }

        const blockedIds = new Set((supportDashboard?.queues?.blocked_clients || []).map((entry: any) => entry.client_id));
        const governanceIds = new Set((supportDashboard?.queues?.governance_attention || []).map((entry: any) => entry.client_id));
        const limitIds = new Set((supportDashboard?.queues?.limit_attention || []).map((entry: any) => entry.client_id));
        const onboardingIds = new Set(onboardingAttentionQueue.map((entry: any) => entry.client_id));

        let healthyClients = 0;
        let attentionClients = 0;
        let blockedClients = 0;

        for (const client of clients) {
            if (blockedIds.has(client.client_code)) {
                blockedClients += 1;
                continue;
            }

            const expiringSoon = expiringSubscriptions.some((entry) => entry.client_id === client.client_code && entry.days_remaining <= 7);
            if (governanceIds.has(client.client_code) || limitIds.has(client.client_code) || onboardingIds.has(client.client_code) || expiringSoon) {
                attentionClients += 1;
                continue;
            }

            healthyClients += 1;
        }

        return {
            metrics: {
                total_clients: clients.length,
                active_clients: clients.filter((client) => client.status === 'active').length,
                suspended_clients: clients.filter((client) => client.status === 'suspended').length,
                inactive_clients: clients.filter((client) => ['inactive', 'closed'].includes(client.status)).length,
                onboarding_clients: clients.filter((client) => ['draft', 'onboarding'].includes(client.status)).length,
                trial_clients: trialClients,
                expiring_subscriptions_7_days: expiringSubscriptions.filter((entry) => entry.days_remaining <= 7).length,
                expiring_subscriptions_30_days: expiringSubscriptions.length,
                over_limit_clients: (supportDashboard?.queues?.limit_attention || []).filter((entry: any) =>
                    Array.isArray(entry.warnings) && entry.warnings.some((warning: string) => warning.includes('limit reached')),
                ).length,
                governance_attention_clients: supportDashboard?.queues?.governance_attention?.length || 0,
                support_attention_clients: new Set([
                    ...(supportDashboard?.queues?.blocked_clients || []).map((entry: any) => entry.client_id),
                    ...(supportDashboard?.queues?.governance_attention || []).map((entry: any) => entry.client_id),
                    ...(supportDashboard?.queues?.limit_attention || []).map((entry: any) => entry.client_id),
                    ...onboardingAttentionQueue.map((entry: any) => entry.client_id),
                    ...expiringSubscriptions.filter((entry) => entry.days_remaining <= 7).map((entry) => entry.client_id),
                ]).size,
            },
            operational_monitoring: supportDashboard?.operational_metrics || {
                monitored_clients: clients.length,
                monitored_branches: 0,
                monitored_devices: 0,
                clients_with_sync_issues: 0,
                failed_sync_events: 0,
                conflicted_sync_events: 0,
                clients_with_failed_jobs: 0,
                failed_job_count: 0,
                unhealthy_clients: 0,
            },
            issue_summary: supportDashboard?.issue_summary || {
                open_issues: 0,
                critical: 0,
                warning: 0,
                categories: [],
            },
            onboarding_pipeline: {
                not_started: onboardingRows.filter((row: any) => row.onboarding_status === 'not_started').length,
                in_progress: onboardingRows.filter((row: any) => row.onboarding_status === 'in_progress').length,
                blocked: onboardingRows.filter((row: any) => ['blocked', 'failed'].includes(row.onboarding_status)).length,
                ready_for_activation: onboardingRows.filter((row: any) => row.onboarding_status === 'ready_for_activation').length,
            },
            commercial: {
                clients_by_plan: [...planDistributionMap.entries()]
                    .map(([plan_name, client_count]) => ({ plan_name, client_count }))
                    .sort((a, b) => b.client_count - a.client_count),
                subscription_states: [...subscriptionStateCounts.entries()]
                    .map(([status, client_count]) => ({ status, client_count }))
                    .sort((a, b) => b.client_count - a.client_count),
                retired_plan_clients: retiredPlanClients,
            },
            health_summary: {
                healthy_clients: healthyClients,
                attention_clients: attentionClients,
                blocked_clients: blockedClients,
            },
            queues: {
                expiring_subscriptions: expiringSubscriptions.slice(0, 12),
                blocked_clients: supportDashboard?.queues?.blocked_clients || [],
                onboarding_attention: supportDashboard?.queues?.onboarding_attention || [],
                governance_attention: supportDashboard?.queues?.governance_attention || [],
                limit_attention: supportDashboard?.queues?.limit_attention || [],
            },
        };
    }

    async getAttentionSummary() {
        const [clients, subscriptions, onboardingQueue, supportDashboard] = await Promise.all([
            this.clientRepo.find({
                relations: ['subscription_plan'],
                order: { updated_at: 'DESC' },
            }),
            this.clientSubscriptionRepo.find({
                relations: ['plan'],
                order: { effective_start_at: 'DESC', created_at: 'DESC' },
            }),
            this.onboardingService.listQueue(),
            this.supportWorkspaceService.getDashboard(),
        ]);

        const currentSubscriptionMap = this.buildCurrentSubscriptionMap(subscriptions);
        const expiringSubscriptions = this.collectExpiringSubscriptions(clients, currentSubscriptionMap);

        return {
            expiring_subscriptions: expiringSubscriptions,
            blocked_clients: supportDashboard?.queues?.blocked_clients || [],
            onboarding_attention: supportDashboard?.queues?.onboarding_attention || [],
            governance_attention: supportDashboard?.queues?.governance_attention || [],
            limit_attention: supportDashboard?.queues?.limit_attention || [],
            sync_attention: supportDashboard?.queues?.sync_attention || [],
            failed_jobs_attention: supportDashboard?.queues?.failed_jobs_attention || [],
            client_health: supportDashboard?.queues?.client_health || [],
            queue_sizes: {
                expiring_subscriptions: expiringSubscriptions.length,
                blocked_clients: supportDashboard?.queues?.blocked_clients?.length || 0,
                onboarding_attention: supportDashboard?.queues?.onboarding_attention?.length || 0,
                governance_attention: supportDashboard?.queues?.governance_attention?.length || 0,
                limit_attention: supportDashboard?.queues?.limit_attention?.length || 0,
                sync_attention: supportDashboard?.queues?.sync_attention?.length || 0,
                failed_jobs_attention: supportDashboard?.queues?.failed_jobs_attention?.length || 0,
                client_health: supportDashboard?.queues?.client_health?.length || 0,
            },
        };
    }

    async getKpis() {
        // 1. Client Counts
        const totalClients = await this.clientRepo.count();
        const activeClients = await this.clientRepo.count({ where: { status: 'active' } });
        const suspendedClients = await this.clientRepo.count({ where: { status: 'suspended' } });

        const clientGrowth = 0; // Deriving real growth requires historical snapshots

        // 2. Revenue (MRR/ARR)
        // We sum actual plan prices for active clients
        const activeClientsWithPlans = await this.clientRepo.find({
            where: { status: 'active' },
            relations: ['subscription_plan']
        });

        let mrrTotal = 0;
        activeClientsWithPlans.forEach(c => {
            if (c.subscription_plan) {
                const monthlyPrice = parseFloat(c.subscription_plan.monthly_price.toString());
                const annualPrice = parseFloat(c.subscription_plan.annual_price.toString());
                mrrTotal += c.subscription_type === 'annual' ? (annualPrice / 12) : monthlyPrice;
            }
        });

        const arrTotal = mrrTotal * 12;
        const revenueGrowth = 0;

        // 3. Branches & UserManagements
        const totalBranchesResult = await this.clientRepo.createQueryBuilder('c')
            .select('SUM(c.max_branches)', 'total')
            .getRawOne();
        const totalBranches = parseInt(totalBranchesResult.total || 0);
        const activeBranches = totalBranches; // Real state tracking needed for live node status

        const totalSysUserManagements = await this.sysUserManagementRepo.count({ where: { user_type: 'PLATFORM_ADMIN' } });

        // 4. Module Adoption Rate
        const clientsWithModules = await this.clientRepo.find({ select: ['enabled_modules_json'] });
        const moduleCounts: Record<string, number> = {};
        clientsWithModules.forEach(c => {
            const mods = c.enabled_modules || [];
            mods.forEach(m => {
                moduleCounts[m] = (moduleCounts[m] || 0) + 1;
            });
        });

        const moduleUsage = Object.entries(moduleCounts).map(([name, count]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
            usage: Math.round((count / (totalClients || 1)) * 100)
        })).sort((a, b) => b.usage - a.usage).slice(0, 5);

        // 5. Monthly Signup Distribution (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const rawSignups = await this.clientRepo.createQueryBuilder('c')
            .select("DATE_FORMAT(c.created_at, '%a')", 'day')
            .addSelect("COUNT(c.id)", 'signups')
            .where("c.created_at >= :date", { date: sevenDaysAgo })
            .groupBy('day')
            .getRawMany();

        // 6. Distribution by Plan
        const clientsByPlan = await this.clientRepo.createQueryBuilder('client')
            .leftJoin('client.subscription_plan', 'plan')
            .select('plan.plan_name', 'name')
            .addSelect('COUNT(client.id)', 'value')
            .where('client.status = :active', { active: 'active' })
            .groupBy('plan.plan_name')
            .getRawMany();

        return {
            clients: { total: totalClients, active: activeClients, suspended: suspendedClients, growth: clientGrowth.toFixed(1) },
            systemUserManagements: { total: totalSysUserManagements, active: totalSysUserManagements },
            revenue: { total: mrrTotal, arr: arrTotal, growth: revenueGrowth, netRevRetention: 100 },
            branches: { total: totalBranches, active: activeBranches, growth: 0 },
            charts: {
                moduleUsage,
                weeklySignups: rawSignups,
                planDistribution: clientsByPlan.map(p => ({
                    ...p,
                    value: Math.round((parseInt(p.value) / (activeClients || 1)) * 100)
                }))
            }
        };
    }

    async getRevenueTrend(months: number = 6) {
        // Return empty until real historical data is available in subscription_orders
        return [];
    }

    async getRecentActivity(limit: number = 10) {
        const recentClients = await this.clientRepo.find({
            order: { created_at: 'DESC' },
            relations: ['subscription_plan'],
            take: limit
        });

        // Map to match frontend fields exactly
        const mappedClients = recentClients.map(c => ({
            client_name: c.client_name,
            domain_slug: c.domain_slug,
            plan: c.subscription_plan?.plan_name || 'Starter',
            status: c.status,
            branches: c.max_branches,
            mrr: c.subscription_type === 'annual' ? (Number(c.subscription_plan?.annual_price || 0) / 12) : Number(c.subscription_plan?.monthly_price || 0),
            signed: this.getTimeAgo(c.created_at)
        }));

        return {
            clients: mappedClients
        };
    }

    async getHealth() {
        return this.operationalReliabilityService.getOperationalSnapshot();
    }

    private getTimeAgo(date: Date): string {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "just now";
    }

    private buildCurrentSubscriptionMap(subscriptions: ClientSubscription[]): Map<string, ClientSubscription> {
        const grouped = new Map<string, ClientSubscription[]>();
        for (const subscription of subscriptions) {
            const existing = grouped.get(subscription.client_id) || [];
            existing.push(subscription);
            grouped.set(subscription.client_id, existing);
        }

        const map = new Map<string, ClientSubscription>();
        const priority = ['active', 'grace', 'trial', 'suspended', 'pending'];
        for (const [clientId, clientSubscriptions] of grouped.entries()) {
            let selected = clientSubscriptions[0];
            for (const status of priority) {
                const match = clientSubscriptions.find((entry) => entry.status === status);
                if (match) {
                    selected = match;
                    break;
                }
            }
            map.set(clientId, selected);
        }

        return map;
    }

    private collectExpiringSubscriptions(
        clients: Client[],
        currentSubscriptionMap: Map<string, ClientSubscription>,
    ) {
        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const items: Array<{
            client_id: string;
            client_code: string | null;
            client_name: string;
            client_status: string;
            subscription_status: string;
            current_plan_name: string | null;
            expires_at: Date;
            days_remaining: number;
            is_trial: boolean;
            severity: 'warning' | 'critical';
            reason: string;
        }> = [];

        for (const client of clients) {
            const subscription = currentSubscriptionMap.get(client.client_code);
            if (!subscription || !['active', 'trial', 'grace'].includes(subscription.status)) {
                continue;
            }

            const expiry = subscription.grace_end_at || subscription.trial_end_at || subscription.effective_end_at;
            if (!expiry) {
                continue;
            }

            const diffMs = expiry.getTime() - now.getTime();
            if (diffMs < 0 || diffMs > thirtyDaysMs) {
                continue;
            }

            items.push({
                client_id: client.client_code,
                client_code: client.client_code,
                client_name: client.client_name,
                client_status: client.status,
                subscription_status: subscription.status,
                current_plan_name: subscription.plan_name_snapshot || subscription.plan?.plan_name || null,
                expires_at: expiry,
                days_remaining: Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000))),
                is_trial: subscription.is_trial,
                severity: diffMs <= 7 * 24 * 60 * 60 * 1000 ? 'critical' : 'warning',
                reason: subscription.status === 'grace'
                    ? `Grace access ends in ${Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))} day(s)`
                    : subscription.is_trial
                        ? `Trial expires in ${Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))} day(s)`
                        : `Subscription expires in ${Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))} day(s)`,
            });
        }

        return items.sort((a, b) => a.days_remaining - b.days_remaining);
    }
}
