import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { resolveActorId } from '../auth/request-context.util';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { Branch } from '../setup/entities/branch.entity';
import { AccountingService } from './accounting.service';
import {
    CreateInvestorAgreementDto,
    CreateInvestorDto,
    CreateInvestorTransactionDto,
    ListAgreementQueryDto,
    ListInvestorQueryDto,
    ListInvestorTransactionQueryDto,
    ListProfitDistributionQueryDto,
    ProcessProfitDistributionDto,
    ReturnInvestorCapitalDto,
    UpdateInvestorAgreementDto,
    UpdateInvestorDto,
} from './dto/investor-profit.dto';
import {
    AccountingInvestorAgreement,
    InvestorAgreementStatus,
    InvestorAgreementType,
} from './entities/investor-agreement.entity';
import { AccountingInvestor, InvestorStatus } from './entities/investor.entity';
import {
    AccountingInvestorTransaction,
    InvestorTransactionType,
} from './entities/investor-transaction.entity';
import {
    AccountingProfitDistributionBatch,
    ProfitDistributionBatchStatus,
} from './entities/profit-distribution-batch.entity';
import { AccountingProfitDistributionLine } from './entities/profit-distribution-line.entity';

type DistributionPreviewLine = {
    investor_id: number;
    investor_name: string;
    agreement_id: number;
    agreement_code: string;
    agreement_name: string;
    capital_basis_amount: number;
    profit_share_percent: number;
    fixed_return_percent: number;
    management_charge_percent: number;
    profit_share_amount: number;
    fixed_return_amount: number;
    gross_distribution_amount: number;
    management_charge_amount: number;
    net_distribution_amount: number;
};

@Injectable()
export class InvestorProfitService {
    constructor(
        @InjectRepository(AccountingInvestor)
        private readonly investorRepo: Repository<AccountingInvestor>,
        @InjectRepository(AccountingInvestorAgreement)
        private readonly agreementRepo: Repository<AccountingInvestorAgreement>,
        @InjectRepository(AccountingInvestorTransaction)
        private readonly transactionRepo: Repository<AccountingInvestorTransaction>,
        @InjectRepository(AccountingProfitDistributionBatch)
        private readonly batchRepo: Repository<AccountingProfitDistributionBatch>,
        @InjectRepository(AccountingProfitDistributionLine)
        private readonly batchLineRepo: Repository<AccountingProfitDistributionLine>,
        @InjectRepository(Branch)
        private readonly branchRepo: Repository<Branch>,
        private readonly accountingService: AccountingService,
        private readonly dataSource: DataSource,
    ) {}

    private normalizeAmount(value: unknown): number {
        const parsed = Number(value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private roundMoney(value: unknown): number {
        return Number(this.normalizeAmount(value).toFixed(2));
    }

    private buildCode(prefix: string): string {
        return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }

    private daysInclusive(start: string, end: string): number {
        const startDate = new Date(`${start}T00:00:00`);
        const endDate = new Date(`${end}T00:00:00`);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
            throw new BadRequestException('Invalid calculation period supplied.');
        }
        return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    }

    private async assertBranchBelongsToClient(clientId: string, branchId: number): Promise<void> {
        const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
        if (!branch) {
            throw new NotFoundException('Branch not found');
        }
    }

    private validateAgreementShape(dto: CreateInvestorAgreementDto | UpdateInvestorAgreementDto) {
        const sharePercent = this.normalizeAmount(dto.profit_share_percent);
        const fixedPercent = this.normalizeAmount(dto.fixed_return_percent);
        const managementPercent = this.normalizeAmount(dto.management_charge_percent);

        if (sharePercent > 100 || fixedPercent > 100 || managementPercent > 100) {
            throw new BadRequestException('Percentages cannot exceed 100.');
        }
        if (dto.effective_to && dto.effective_to < dto.effective_from) {
            throw new BadRequestException('Agreement end date cannot be before start date.');
        }
        if (dto.agreement_type === InvestorAgreementType.PROFIT_SHARE && sharePercent <= 0) {
            throw new BadRequestException('Profit-share agreements require a profit share percentage.');
        }
        if (dto.agreement_type === InvestorAgreementType.PROFIT_SHARE && fixedPercent > 0) {
            throw new BadRequestException('Profit-share agreements cannot carry a fixed return percentage.');
        }
        if (dto.agreement_type === InvestorAgreementType.FIXED_RETURN && fixedPercent <= 0) {
            throw new BadRequestException('Fixed-return agreements require a fixed return percentage.');
        }
        if (dto.agreement_type === InvestorAgreementType.FIXED_RETURN && sharePercent > 0) {
            throw new BadRequestException('Fixed-return agreements cannot carry a profit share percentage.');
        }
        if (dto.agreement_type === InvestorAgreementType.HYBRID && sharePercent <= 0 && fixedPercent <= 0) {
            throw new BadRequestException('Hybrid agreements require at least one distribution component.');
        }
    }

    private async validateAgreementPortfolio(
        clientId: string,
        branchId: number,
        dto: CreateInvestorAgreementDto | UpdateInvestorAgreementDto,
        currentAgreementId?: number,
    ) {
        const activeAgreements = await this.agreementRepo.find({
            where: {
                client_id: clientId,
                branch_id: branchId,
                status: InvestorAgreementStatus.ACTIVE,
            },
        });

        const overlappingForInvestor = activeAgreements.filter((agreement) =>
            agreement.investor_id === dto.investor_id
            && agreement.id !== currentAgreementId
            && (!dto.effective_to || agreement.effective_from <= dto.effective_to)
            && (!agreement.effective_to || agreement.effective_to >= dto.effective_from),
        );
        if (dto.status === InvestorAgreementStatus.ACTIVE && overlappingForInvestor.length > 0) {
            throw new BadRequestException('An overlapping active agreement already exists for this investor and branch.');
        }

        const portfolioShare = activeAgreements
            .filter((agreement) => agreement.id !== currentAgreementId)
            .reduce((sum, agreement) => sum + this.normalizeAmount(agreement.profit_share_percent), 0)
            + (dto.status === InvestorAgreementStatus.ACTIVE ? this.normalizeAmount(dto.profit_share_percent) : 0);

        if (portfolioShare > 100.0001) {
            throw new BadRequestException('Total active profit share percentages for the branch cannot exceed 100%.');
        }
    }

    private getCapitalDelta(type: InvestorTransactionType, amount: number): number {
        switch (type) {
            case InvestorTransactionType.CAPITAL_INJECTION:
            case InvestorTransactionType.MANUAL_INCREASE:
                return amount;
            case InvestorTransactionType.CAPITAL_WITHDRAWAL:
            case InvestorTransactionType.CAPITAL_RETURN:
            case InvestorTransactionType.MANUAL_DECREASE:
                return -amount;
            default:
                return 0;
        }
    }

    async listInvestors(clientId: string, query: ListInvestorQueryDto) {
        if (query.branch_id) {
            await this.assertBranchBelongsToClient(clientId, query.branch_id);
        }

        const investorBuilder = this.investorRepo.createQueryBuilder('investor')
            .where('investor.client_id = :clientId', { clientId })
            .orderBy('investor.full_name', 'ASC');

        if (query.status) {
            investorBuilder.andWhere('investor.status = :status', { status: query.status });
        }
        if (query.search?.trim()) {
            investorBuilder.andWhere('(investor.full_name LIKE :term OR investor.investor_code LIKE :term OR investor.phone LIKE :term OR investor.email LIKE :term)', {
                term: `%${query.search.trim()}%`,
            });
        }

        const investors = await investorBuilder.getMany();
        const agreements = investors.length > 0
            ? await this.agreementRepo.createQueryBuilder('agreement')
                .leftJoinAndSelect('agreement.branch', 'branch')
                .where('agreement.client_id = :clientId', { clientId })
                .andWhere('agreement.investor_id IN (:...investorIds)', { investorIds: investors.map((investor) => investor.id) })
                .andWhere(query.branch_id ? 'agreement.branch_id = :branchId' : '1 = 1', { branchId: query.branch_id })
                .orderBy('agreement.created_at', 'DESC')
                .getMany()
            : [];

        const agreementsByInvestor = new Map<number, AccountingInvestorAgreement[]>();
        for (const agreement of agreements) {
            const current = agreementsByInvestor.get(agreement.investor_id) ?? [];
            current.push(agreement);
            agreementsByInvestor.set(agreement.investor_id, current);
        }

        const primaryBranchIds = investors.map((investor) => investor.primary_branch_id).filter((value): value is number => Boolean(value));
        const branches = primaryBranchIds.length > 0
            ? await this.branchRepo.findBy({ client_id: clientId })
            : [];
        const branchMap = new Map(branches.map((branch) => [branch.id, branch.branch_name]));

        return investors.map((investor) => {
            const investorAgreements = agreementsByInvestor.get(investor.id) ?? [];
            const activeAgreements = investorAgreements.filter((agreement) => agreement.status === InvestorAgreementStatus.ACTIVE);
            return {
                id: investor.id,
                investor_code: investor.investor_code,
                full_name: investor.full_name,
                phone: investor.phone,
                email: investor.email,
                address: investor.address,
                status: investor.status,
                notes: investor.notes,
                primary_branch_id: investor.primary_branch_id,
                primary_branch_name: investor.primary_branch_id ? branchMap.get(investor.primary_branch_id) ?? null : null,
                created_at: investor.created_at,
                active_agreement_count: activeAgreements.length,
                current_capital_balance: this.roundMoney(activeAgreements.reduce((sum, agreement) => sum + this.normalizeAmount(agreement.current_capital_balance), 0)),
                total_distributed_amount: this.roundMoney(investorAgreements.reduce((sum, agreement) => sum + this.normalizeAmount(agreement.total_distributed_amount), 0)),
                agreements: investorAgreements.map((agreement) => ({
                    id: agreement.id,
                    agreement_code: agreement.agreement_code,
                    agreement_name: agreement.agreement_name,
                    branch_id: agreement.branch_id,
                    branch_name: agreement.branch?.branch_name ?? null,
                    agreement_type: agreement.agreement_type,
                    distribution_frequency: agreement.distribution_frequency,
                    capital_commitment_amount: this.roundMoney(agreement.capital_commitment_amount),
                    current_capital_balance: this.roundMoney(agreement.current_capital_balance),
                    profit_share_percent: this.roundMoney(agreement.profit_share_percent),
                    fixed_return_percent: this.roundMoney(agreement.fixed_return_percent),
                    management_charge_percent: this.roundMoney(agreement.management_charge_percent),
                    total_distributed_amount: this.roundMoney(agreement.total_distributed_amount),
                    effective_from: agreement.effective_from,
                    effective_to: agreement.effective_to,
                    status: agreement.status,
                    notes: agreement.notes,
                })),
            };
        });
    }

    async createInvestor(clientId: string, dto: CreateInvestorDto) {
        if (dto.primary_branch_id) {
            await this.assertBranchBelongsToClient(clientId, dto.primary_branch_id);
        }
        const investor = this.investorRepo.create({
            client_id: clientId,
            investor_code: this.buildCode('INV'),
            full_name: dto.full_name.trim(),
            phone: dto.phone?.trim() || null,
            email: dto.email?.trim() || null,
            address: dto.address?.trim() || null,
            primary_branch_id: dto.primary_branch_id ?? null,
            status: dto.status ?? InvestorStatus.ACTIVE,
            notes: dto.notes?.trim() || null,
        });
        return this.investorRepo.save(investor);
    }

    async updateInvestor(clientId: string, id: number, dto: UpdateInvestorDto) {
        const investor = await this.investorRepo.findOne({ where: { id, client_id: clientId } });
        if (!investor) {
            throw new NotFoundException('Investor not found');
        }
        if (dto.primary_branch_id) {
            await this.assertBranchBelongsToClient(clientId, dto.primary_branch_id);
        }
        investor.full_name = dto.full_name.trim();
        investor.phone = dto.phone?.trim() || null;
        investor.email = dto.email?.trim() || null;
        investor.address = dto.address?.trim() || null;
        investor.primary_branch_id = dto.primary_branch_id ?? null;
        investor.status = dto.status ?? investor.status;
        investor.notes = dto.notes?.trim() || null;
        return this.investorRepo.save(investor);
    }

    async listAgreements(clientId: string, query: ListAgreementQueryDto) {
        if (query.branch_id) {
            await this.assertBranchBelongsToClient(clientId, query.branch_id);
        }
        const builder = this.agreementRepo.createQueryBuilder('agreement')
            .leftJoinAndSelect('agreement.investor', 'investor')
            .leftJoinAndSelect('agreement.branch', 'branch')
            .where('agreement.client_id = :clientId', { clientId })
            .orderBy('agreement.created_at', 'DESC');
        if (query.investor_id) {
            builder.andWhere('agreement.investor_id = :investorId', { investorId: query.investor_id });
        }
        if (query.branch_id) {
            builder.andWhere('agreement.branch_id = :branchId', { branchId: query.branch_id });
        }
        if (query.status) {
            builder.andWhere('agreement.status = :status', { status: query.status });
        }
        const rows = await builder.getMany();
        return rows.map((agreement) => ({
            id: agreement.id,
            agreement_code: agreement.agreement_code,
            agreement_name: agreement.agreement_name,
            investor_id: agreement.investor_id,
            investor_name: agreement.investor?.full_name ?? null,
            branch_id: agreement.branch_id,
            branch_name: agreement.branch?.branch_name ?? null,
            agreement_type: agreement.agreement_type,
            distribution_frequency: agreement.distribution_frequency,
            capital_commitment_amount: this.roundMoney(agreement.capital_commitment_amount),
            current_capital_balance: this.roundMoney(agreement.current_capital_balance),
            profit_share_percent: this.roundMoney(agreement.profit_share_percent),
            fixed_return_percent: this.roundMoney(agreement.fixed_return_percent),
            management_charge_percent: this.roundMoney(agreement.management_charge_percent),
            total_distributed_amount: this.roundMoney(agreement.total_distributed_amount),
            effective_from: agreement.effective_from,
            effective_to: agreement.effective_to,
            status: agreement.status,
            notes: agreement.notes,
        }));
    }

    async createAgreement(clientId: string, dto: CreateInvestorAgreementDto, user?: JwtPayload) {
        this.validateAgreementShape(dto);
        await this.assertBranchBelongsToClient(clientId, dto.branch_id);
        const investor = await this.investorRepo.findOne({ where: { id: dto.investor_id, client_id: clientId } });
        if (!investor) {
            throw new NotFoundException('Investor not found');
        }
        await this.validateAgreementPortfolio(clientId, dto.branch_id, dto);

        return this.dataSource.transaction(async (manager) => {
            const agreement = manager.create(AccountingInvestorAgreement, {
                client_id: clientId,
                investor_id: dto.investor_id,
                branch_id: dto.branch_id,
                agreement_code: this.buildCode('AGR'),
                agreement_name: dto.agreement_name.trim(),
                agreement_type: dto.agreement_type,
                distribution_frequency: dto.distribution_frequency,
                capital_commitment_amount: this.roundMoney(dto.capital_commitment_amount),
                current_capital_balance: this.roundMoney(dto.capital_commitment_amount),
                profit_share_percent: this.roundMoney(dto.profit_share_percent),
                fixed_return_percent: this.roundMoney(dto.fixed_return_percent),
                management_charge_percent: this.roundMoney(dto.management_charge_percent),
                total_distributed_amount: 0,
                effective_from: dto.effective_from,
                effective_to: dto.effective_to ?? null,
                status: dto.status ?? InvestorAgreementStatus.ACTIVE,
                notes: dto.notes?.trim() || null,
            });
            const savedAgreement = await manager.save(agreement);

            if (this.normalizeAmount(dto.capital_commitment_amount) > 0) {
                const actorId = resolveActorId(user);
                await manager.save(AccountingInvestorTransaction, manager.create(AccountingInvestorTransaction, {
                    client_id: clientId,
                    investor_id: dto.investor_id,
                    agreement_id: savedAgreement.id,
                    branch_id: dto.branch_id,
                    transaction_date: dto.effective_from,
                    transaction_type: InvestorTransactionType.CAPITAL_INJECTION,
                    amount: this.roundMoney(dto.capital_commitment_amount),
                    description: `Initial capital for ${savedAgreement.agreement_name}`,
                    reference_no: savedAgreement.agreement_code,
                    created_by_user_id: actorId ? Number(actorId) : null,
                    created_by_name: user?.username || user?.email || null,
                }));
            }

            return savedAgreement;
        });
    }

    async updateAgreement(clientId: string, id: number, dto: UpdateInvestorAgreementDto) {
        this.validateAgreementShape(dto);
        const agreement = await this.agreementRepo.findOne({ where: { id, client_id: clientId } });
        if (!agreement) {
            throw new NotFoundException('Agreement not found');
        }
        await this.assertBranchBelongsToClient(clientId, dto.branch_id);
        await this.validateAgreementPortfolio(clientId, dto.branch_id, dto, agreement.id);

        agreement.investor_id = dto.investor_id;
        agreement.branch_id = dto.branch_id;
        agreement.agreement_name = dto.agreement_name.trim();
        agreement.agreement_type = dto.agreement_type;
        agreement.distribution_frequency = dto.distribution_frequency;
        agreement.profit_share_percent = this.roundMoney(dto.profit_share_percent);
        agreement.fixed_return_percent = this.roundMoney(dto.fixed_return_percent);
        agreement.management_charge_percent = this.roundMoney(dto.management_charge_percent);
        agreement.effective_from = dto.effective_from;
        agreement.effective_to = dto.effective_to ?? null;
        agreement.status = dto.status ?? agreement.status;
        agreement.notes = dto.notes?.trim() || null;
        return this.agreementRepo.save(agreement);
    }

    async listTransactions(clientId: string, query: ListInvestorTransactionQueryDto) {
        if (query.branch_id) {
            await this.assertBranchBelongsToClient(clientId, query.branch_id);
        }
        const builder = this.transactionRepo.createQueryBuilder('tx')
            .leftJoinAndSelect('tx.investor', 'investor')
            .leftJoinAndSelect('tx.agreement', 'agreement')
            .leftJoinAndSelect('tx.branch', 'branch')
            .where('tx.client_id = :clientId', { clientId })
            .orderBy('tx.transaction_date', 'DESC')
            .addOrderBy('tx.id', 'DESC');
        if (query.investor_id) {
            builder.andWhere('tx.investor_id = :investorId', { investorId: query.investor_id });
        }
        if (query.agreement_id) {
            builder.andWhere('tx.agreement_id = :agreementId', { agreementId: query.agreement_id });
        }
        if (query.branch_id) {
            builder.andWhere('tx.branch_id = :branchId', { branchId: query.branch_id });
        }
        if (query.date_from && query.date_to) {
            builder.andWhere('tx.transaction_date BETWEEN :dateFrom AND :dateTo', { dateFrom: query.date_from, dateTo: query.date_to });
        } else if (query.date_from) {
            builder.andWhere('tx.transaction_date >= :dateFrom', { dateFrom: query.date_from });
        } else if (query.date_to) {
            builder.andWhere('tx.transaction_date <= :dateTo', { dateTo: query.date_to });
        }
        const rows = await builder.getMany();
        return rows.map((tx) => ({
            id: tx.id,
            investor_id: tx.investor_id,
            investor_name: tx.investor?.full_name ?? null,
            agreement_id: tx.agreement_id,
            agreement_code: tx.agreement?.agreement_code ?? null,
            agreement_name: tx.agreement?.agreement_name ?? null,
            branch_id: tx.branch_id,
            branch_name: tx.branch?.branch_name ?? null,
            transaction_date: tx.transaction_date,
            transaction_type: tx.transaction_type,
            amount: this.roundMoney(tx.amount),
            description: tx.description,
            reference_no: tx.reference_no,
            period_start: tx.period_start,
            period_end: tx.period_end,
            distribution_batch_id: tx.distribution_batch_id,
            created_by_name: tx.created_by_name,
            created_at: tx.created_at,
        }));
    }

    async createTransaction(clientId: string, dto: CreateInvestorTransactionDto, user?: JwtPayload) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id);
        const investor = await this.investorRepo.findOne({ where: { id: dto.investor_id, client_id: clientId } });
        if (!investor) {
            throw new NotFoundException('Investor not found');
        }
        const agreement = await this.agreementRepo.findOne({
            where: {
                id: dto.agreement_id,
                client_id: clientId,
                investor_id: dto.investor_id,
                branch_id: dto.branch_id,
            },
        });
        if (!agreement) {
            throw new NotFoundException('Agreement not found');
        }
        if ([InvestorTransactionType.PROFIT_DISTRIBUTION, InvestorTransactionType.MANAGEMENT_CHARGE].includes(dto.transaction_type)) {
            throw new BadRequestException('System-generated transaction types cannot be created manually.');
        }

        const amount = this.roundMoney(dto.amount);
        const capitalDelta = this.getCapitalDelta(dto.transaction_type, amount);
        const nextCapital = this.roundMoney(this.normalizeAmount(agreement.current_capital_balance) + capitalDelta);
        if (nextCapital < -0.009) {
            throw new BadRequestException('Capital movement would reduce the agreement below zero.');
        }

        const actorId = resolveActorId(user);
        return this.dataSource.transaction(async (manager) => {
            const record = manager.create(AccountingInvestorTransaction, {
                client_id: clientId,
                investor_id: dto.investor_id,
                agreement_id: dto.agreement_id,
                branch_id: dto.branch_id,
                transaction_date: dto.transaction_date,
                transaction_type: dto.transaction_type,
                amount,
                description: dto.description?.trim() || null,
                reference_no: dto.reference_no?.trim() || null,
                created_by_user_id: actorId ? Number(actorId) : null,
                created_by_name: user?.username || user?.email || null,
            });
            const saved = await manager.save(record);
            agreement.current_capital_balance = nextCapital;
            await manager.save(agreement);
            return saved;
        });
    }

    async returnCapital(clientId: string, dto: ReturnInvestorCapitalDto, user?: JwtPayload) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id);
        const investor = await this.investorRepo.findOne({ where: { id: dto.investor_id, client_id: clientId } });
        if (!investor) {
            throw new NotFoundException('Investor not found');
        }
        const agreement = await this.agreementRepo.findOne({
            where: {
                id: dto.agreement_id,
                client_id: clientId,
                investor_id: dto.investor_id,
                branch_id: dto.branch_id,
            },
        });
        if (!agreement) {
            throw new NotFoundException('Agreement not found');
        }

        const returnAmount = this.roundMoney(agreement.current_capital_balance);
        if (returnAmount <= 0) {
            throw new BadRequestException('This agreement has no capital balance left to return.');
        }

        const actorId = resolveActorId(user);
        return this.dataSource.transaction(async (manager) => {
            const record = manager.create(AccountingInvestorTransaction, {
                client_id: clientId,
                investor_id: dto.investor_id,
                agreement_id: dto.agreement_id,
                branch_id: dto.branch_id,
                transaction_date: dto.transaction_date,
                transaction_type: InvestorTransactionType.CAPITAL_RETURN,
                amount: returnAmount,
                description: dto.description?.trim() || `Full capital return for ${agreement.agreement_name}`,
                reference_no: dto.reference_no?.trim() || `${agreement.agreement_code}-RETURN`,
                created_by_user_id: actorId ? Number(actorId) : null,
                created_by_name: user?.username || user?.email || null,
            });
            const saved = await manager.save(record);

            agreement.current_capital_balance = 0;
            if (agreement.status === InvestorAgreementStatus.ACTIVE || agreement.status === InvestorAgreementStatus.MATURED) {
                agreement.status = InvestorAgreementStatus.CLOSED;
            }
            await manager.save(agreement);
            return saved;
        });
    }

    async getInvestorStatement(clientId: string, investorId: number, branchId?: number, periodStart?: string, periodEnd?: string) {
        if (branchId) {
            await this.assertBranchBelongsToClient(clientId, branchId);
        }
        const investor = await this.investorRepo.findOne({ where: { id: investorId, client_id: clientId } });
        if (!investor) {
            throw new NotFoundException('Investor not found');
        }

        const agreements = await this.agreementRepo.createQueryBuilder('agreement')
            .leftJoinAndSelect('agreement.branch', 'branch')
            .where('agreement.client_id = :clientId', { clientId })
            .andWhere('agreement.investor_id = :investorId', { investorId })
            .andWhere(branchId ? 'agreement.branch_id = :branchId' : '1 = 1', { branchId })
            .orderBy('agreement.created_at', 'DESC')
            .getMany();

        const txBuilder = this.transactionRepo.createQueryBuilder('tx')
            .leftJoinAndSelect('tx.branch', 'branch')
            .leftJoinAndSelect('tx.agreement', 'agreement')
            .where('tx.client_id = :clientId', { clientId })
            .andWhere('tx.investor_id = :investorId', { investorId })
            .orderBy('tx.transaction_date', 'DESC')
            .addOrderBy('tx.id', 'DESC');

        if (branchId) {
            txBuilder.andWhere('tx.branch_id = :branchId', { branchId });
        }
        if (periodStart && periodEnd) {
            txBuilder.andWhere('tx.transaction_date BETWEEN :periodStart AND :periodEnd', { periodStart, periodEnd });
        }
        const transactions = await txBuilder.getMany();

        const capitalInflows = transactions
            .filter((tx) => [InvestorTransactionType.CAPITAL_INJECTION, InvestorTransactionType.MANUAL_INCREASE].includes(tx.transaction_type))
            .reduce((sum, tx) => sum + this.normalizeAmount(tx.amount), 0);
        const capitalOutflows = transactions
            .filter((tx) => [InvestorTransactionType.CAPITAL_WITHDRAWAL, InvestorTransactionType.CAPITAL_RETURN, InvestorTransactionType.MANUAL_DECREASE].includes(tx.transaction_type))
            .reduce((sum, tx) => sum + this.normalizeAmount(tx.amount), 0);
        const profitDistributions = transactions
            .filter((tx) => tx.transaction_type === InvestorTransactionType.PROFIT_DISTRIBUTION)
            .reduce((sum, tx) => sum + this.normalizeAmount(tx.amount), 0);
        const managementCharges = transactions
            .filter((tx) => tx.transaction_type === InvestorTransactionType.MANAGEMENT_CHARGE)
            .reduce((sum, tx) => sum + this.normalizeAmount(tx.amount), 0);

        return {
            investor: {
                id: investor.id,
                investor_code: investor.investor_code,
                full_name: investor.full_name,
                phone: investor.phone,
                email: investor.email,
                status: investor.status,
            },
            summary: {
                agreement_count: agreements.length,
                capital_inflows: this.roundMoney(capitalInflows),
                capital_outflows: this.roundMoney(capitalOutflows),
                current_capital_balance: this.roundMoney(agreements.reduce((sum, agreement) => sum + this.normalizeAmount(agreement.current_capital_balance), 0)),
                profit_distributed: this.roundMoney(profitDistributions),
                management_charges: this.roundMoney(managementCharges),
                net_paid_to_investor: this.roundMoney(profitDistributions - managementCharges),
            },
            agreements: agreements.map((agreement) => ({
                id: agreement.id,
                agreement_code: agreement.agreement_code,
                agreement_name: agreement.agreement_name,
                branch_id: agreement.branch_id,
                branch_name: agreement.branch?.branch_name ?? null,
                agreement_type: agreement.agreement_type,
                distribution_frequency: agreement.distribution_frequency,
                current_capital_balance: this.roundMoney(agreement.current_capital_balance),
                total_distributed_amount: this.roundMoney(agreement.total_distributed_amount),
                effective_from: agreement.effective_from,
                effective_to: agreement.effective_to,
                status: agreement.status,
            })),
            transactions: transactions.map((tx) => ({
                id: tx.id,
                transaction_date: tx.transaction_date,
                transaction_type: tx.transaction_type,
                amount: this.roundMoney(tx.amount),
                description: tx.description,
                reference_no: tx.reference_no,
                period_start: tx.period_start,
                period_end: tx.period_end,
                agreement_id: tx.agreement_id,
                agreement_code: tx.agreement?.agreement_code ?? null,
                branch_name: tx.branch?.branch_name ?? null,
                distribution_batch_id: tx.distribution_batch_id,
            })),
        };
    }

    async previewProfitDistribution(clientId: string, dto: { branch_id: number; period_start: string; period_end: string; distribution_frequency: any }) {
        await this.assertBranchBelongsToClient(clientId, dto.branch_id);
        if (dto.period_end < dto.period_start) {
            throw new BadRequestException('Distribution period end date cannot be before the start date.');
        }

        const existingBatch = await this.batchRepo.findOne({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                distribution_frequency: dto.distribution_frequency,
                period_start: dto.period_start,
                period_end: dto.period_end,
            },
        });

        const profitAndLoss = await this.accountingService.getProfitAndLoss(clientId, dto.branch_id, dto.period_start, dto.period_end);
        const netProfitAmount = this.roundMoney(profitAndLoss.summary.net_profit);
        const positiveProfitBasis = Math.max(netProfitAmount, 0);
        const dayCount = this.daysInclusive(dto.period_start, dto.period_end);

        const agreements = await this.agreementRepo.find({
            where: {
                client_id: clientId,
                branch_id: dto.branch_id,
                distribution_frequency: dto.distribution_frequency,
                status: InvestorAgreementStatus.ACTIVE,
                effective_from: LessThanOrEqual(dto.period_end),
            },
            relations: ['investor'],
            order: { created_at: 'ASC' },
        });
        const eligibleAgreements = agreements.filter((agreement) => !agreement.effective_to || agreement.effective_to >= dto.period_start);

        const lines: DistributionPreviewLine[] = eligibleAgreements.map((agreement) => {
            const capitalBasisAmount = this.roundMoney(agreement.current_capital_balance);
            const profitShareAmount = positiveProfitBasis > 0
                ? this.roundMoney(positiveProfitBasis * (this.normalizeAmount(agreement.profit_share_percent) / 100))
                : 0;
            const fixedReturnAmount = this.roundMoney(
                capitalBasisAmount * (this.normalizeAmount(agreement.fixed_return_percent) / 100) * (dayCount / 365),
            );
            const grossDistributionAmount = this.roundMoney(profitShareAmount + fixedReturnAmount);
            const managementChargeAmount = this.roundMoney(
                grossDistributionAmount * (this.normalizeAmount(agreement.management_charge_percent) / 100),
            );
            return {
                investor_id: agreement.investor_id,
                investor_name: agreement.investor.full_name,
                agreement_id: agreement.id,
                agreement_code: agreement.agreement_code,
                agreement_name: agreement.agreement_name,
                capital_basis_amount: capitalBasisAmount,
                profit_share_percent: this.roundMoney(agreement.profit_share_percent),
                fixed_return_percent: this.roundMoney(agreement.fixed_return_percent),
                management_charge_percent: this.roundMoney(agreement.management_charge_percent),
                profit_share_amount: profitShareAmount,
                fixed_return_amount: fixedReturnAmount,
                gross_distribution_amount: grossDistributionAmount,
                management_charge_amount: managementChargeAmount,
                net_distribution_amount: this.roundMoney(grossDistributionAmount - managementChargeAmount),
            };
        });

        return {
            period: {
                period_start: dto.period_start,
                period_end: dto.period_end,
                day_count: dayCount,
                distribution_frequency: dto.distribution_frequency,
            },
            branch_id: dto.branch_id,
            net_profit_amount: netProfitAmount,
            positive_profit_basis_amount: this.roundMoney(positiveProfitBasis),
            warnings: [
                netProfitAmount < 0 ? 'Net profit for the selected period is negative. Profit-share components were reduced to zero and fixed returns were still calculated.' : null,
                existingBatch ? `A processed batch already exists for ${dto.period_start} to ${dto.period_end}.` : null,
            ].filter(Boolean),
            summary: {
                investor_count: lines.length,
                total_management_charge_amount: this.roundMoney(lines.reduce((sum, line) => sum + line.management_charge_amount, 0)),
                total_distribution_amount: this.roundMoney(lines.reduce((sum, line) => sum + line.net_distribution_amount, 0)),
            },
            lines,
            existing_batch: existingBatch
                ? {
                    id: existingBatch.id,
                    batch_code: existingBatch.batch_code,
                    processed_at: existingBatch.processed_at,
                    total_distribution_amount: this.roundMoney(existingBatch.total_distribution_amount),
                }
                : null,
        };
    }

    async processProfitDistribution(clientId: string, dto: ProcessProfitDistributionDto, user?: JwtPayload) {
        const preview = await this.previewProfitDistribution(clientId, dto);
        if (preview.existing_batch) {
            throw new BadRequestException('This distribution period has already been processed for the selected branch.');
        }

        const actorId = resolveActorId(user);
        return this.dataSource.transaction(async (manager) => {
            const batch = manager.create(AccountingProfitDistributionBatch, {
                client_id: clientId,
                branch_id: dto.branch_id,
                batch_code: this.buildCode('DIST'),
                distribution_frequency: dto.distribution_frequency,
                period_start: dto.period_start,
                period_end: dto.period_end,
                net_profit_amount: preview.net_profit_amount,
                positive_profit_basis_amount: preview.positive_profit_basis_amount,
                total_management_charge_amount: preview.summary.total_management_charge_amount,
                total_distribution_amount: preview.summary.total_distribution_amount,
                status: ProfitDistributionBatchStatus.PROCESSED,
                processed_at: new Date(),
                processed_by_user_id: actorId ? Number(actorId) : null,
                processed_by_name: user?.username || user?.email || null,
                notes: dto.notes?.trim() || null,
            });
            const savedBatch = await manager.save(batch);

            for (const line of preview.lines) {
                await manager.save(AccountingProfitDistributionLine, manager.create(AccountingProfitDistributionLine, {
                    client_id: clientId,
                    batch_id: savedBatch.id,
                    investor_id: line.investor_id,
                    agreement_id: line.agreement_id,
                    branch_id: dto.branch_id,
                    capital_basis_amount: line.capital_basis_amount,
                    profit_share_percent: line.profit_share_percent,
                    fixed_return_percent: line.fixed_return_percent,
                    management_charge_percent: line.management_charge_percent,
                    profit_share_amount: line.profit_share_amount,
                    fixed_return_amount: line.fixed_return_amount,
                    gross_distribution_amount: line.gross_distribution_amount,
                    management_charge_amount: line.management_charge_amount,
                    net_distribution_amount: line.net_distribution_amount,
                }));

                if (line.net_distribution_amount > 0) {
                    await manager.save(AccountingInvestorTransaction, manager.create(AccountingInvestorTransaction, {
                        client_id: clientId,
                        investor_id: line.investor_id,
                        agreement_id: line.agreement_id,
                        branch_id: dto.branch_id,
                        distribution_batch_id: savedBatch.id,
                        transaction_date: dto.period_end,
                        transaction_type: InvestorTransactionType.PROFIT_DISTRIBUTION,
                        amount: line.net_distribution_amount,
                        description: `Profit distribution for ${dto.period_start} to ${dto.period_end}`,
                        reference_no: savedBatch.batch_code,
                        period_start: dto.period_start,
                        period_end: dto.period_end,
                        created_by_user_id: actorId ? Number(actorId) : null,
                        created_by_name: user?.username || user?.email || null,
                    }));
                }

                if (line.management_charge_amount > 0) {
                    await manager.save(AccountingInvestorTransaction, manager.create(AccountingInvestorTransaction, {
                        client_id: clientId,
                        investor_id: line.investor_id,
                        agreement_id: line.agreement_id,
                        branch_id: dto.branch_id,
                        distribution_batch_id: savedBatch.id,
                        transaction_date: dto.period_end,
                        transaction_type: InvestorTransactionType.MANAGEMENT_CHARGE,
                        amount: line.management_charge_amount,
                        description: `Management charge for ${dto.period_start} to ${dto.period_end}`,
                        reference_no: savedBatch.batch_code,
                        period_start: dto.period_start,
                        period_end: dto.period_end,
                        created_by_user_id: actorId ? Number(actorId) : null,
                        created_by_name: user?.username || user?.email || null,
                    }));
                }

                const agreement = await manager.findOneOrFail(AccountingInvestorAgreement, {
                    where: { id: line.agreement_id, client_id: clientId },
                });
                agreement.total_distributed_amount = this.roundMoney(
                    this.normalizeAmount(agreement.total_distributed_amount) + line.net_distribution_amount,
                );
                await manager.save(agreement);
            }

            return this.getDistributionBatch(clientId, savedBatch.id);
        });
    }

    async listProfitDistributions(clientId: string, query: ListProfitDistributionQueryDto) {
        if (query.branch_id) {
            await this.assertBranchBelongsToClient(clientId, query.branch_id);
        }
        const rows = await this.batchRepo.createQueryBuilder('batch')
            .leftJoinAndSelect('batch.branch', 'branch')
            .where('batch.client_id = :clientId', { clientId })
            .andWhere(query.branch_id ? 'batch.branch_id = :branchId' : '1 = 1', { branchId: query.branch_id })
            .orderBy('batch.period_end', 'DESC')
            .addOrderBy('batch.id', 'DESC')
            .getMany();
        return Promise.all(rows.map((row) => this.getDistributionBatch(clientId, row.id)));
    }

    async getDistributionBatch(clientId: string, id: number) {
        const batch = await this.batchRepo.findOne({
            where: { id, client_id: clientId },
            relations: ['branch'],
        });
        if (!batch) {
            throw new NotFoundException('Distribution batch not found');
        }
        const lines = await this.batchLineRepo.find({
            where: { client_id: clientId, batch_id: batch.id },
            relations: ['investor', 'agreement'],
            order: { id: 'ASC' },
        });
        return {
            id: batch.id,
            batch_code: batch.batch_code,
            branch_id: batch.branch_id,
            branch_name: batch.branch?.branch_name ?? null,
            distribution_frequency: batch.distribution_frequency,
            period_start: batch.period_start,
            period_end: batch.period_end,
            net_profit_amount: this.roundMoney(batch.net_profit_amount),
            positive_profit_basis_amount: this.roundMoney(batch.positive_profit_basis_amount),
            total_management_charge_amount: this.roundMoney(batch.total_management_charge_amount),
            total_distribution_amount: this.roundMoney(batch.total_distribution_amount),
            status: batch.status,
            processed_at: batch.processed_at,
            processed_by_name: batch.processed_by_name,
            notes: batch.notes,
            lines: lines.map((line) => ({
                id: line.id,
                investor_id: line.investor_id,
                investor_name: line.investor?.full_name ?? null,
                agreement_id: line.agreement_id,
                agreement_code: line.agreement?.agreement_code ?? null,
                agreement_name: line.agreement?.agreement_name ?? null,
                capital_basis_amount: this.roundMoney(line.capital_basis_amount),
                profit_share_percent: this.roundMoney(line.profit_share_percent),
                fixed_return_percent: this.roundMoney(line.fixed_return_percent),
                management_charge_percent: this.roundMoney(line.management_charge_percent),
                profit_share_amount: this.roundMoney(line.profit_share_amount),
                fixed_return_amount: this.roundMoney(line.fixed_return_amount),
                gross_distribution_amount: this.roundMoney(line.gross_distribution_amount),
                management_charge_amount: this.roundMoney(line.management_charge_amount),
                net_distribution_amount: this.roundMoney(line.net_distribution_amount),
            })),
        };
    }
}
