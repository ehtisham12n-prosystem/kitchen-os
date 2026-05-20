import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Branch } from '../setup/entities/branch.entity';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import { resolveActorId } from '../auth/request-context.util';
import { AccountingService } from './accounting.service';
import { ChartOfAccount } from './entities/chart-of-accounts.entity';
import {
    AccountingLoan,
    AccountingLoanInterestMethod,
    AccountingLoanRepaymentFrequency,
    AccountingLoanStatus,
} from './entities/loan.entity';
import {
    AccountingLoanRepayment,
    AccountingLoanRepaymentStatus,
} from './entities/loan-repayment.entity';
import {
    CreateLoanDto,
    ListLoanQueryDto,
    ListLoanRepaymentQueryDto,
    RecordLoanRepaymentDto,
    SettleLoanDto,
    UpdateLoanDto,
} from './dto/loan.dto';

@Injectable()
export class AccountingLoanService {
    constructor(
        @InjectRepository(AccountingLoan)
        private readonly loanRepo: Repository<AccountingLoan>,
        @InjectRepository(AccountingLoanRepayment)
        private readonly repaymentRepo: Repository<AccountingLoanRepayment>,
        @InjectRepository(ChartOfAccount)
        private readonly coaRepo: Repository<ChartOfAccount>,
        @InjectRepository(Branch)
        private readonly branchRepo: Repository<Branch>,
        private readonly accountingService: AccountingService,
    ) {}

    private roundMoney(value: number): number {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    private addMonths(value: string, months: number): string {
        const date = new Date(`${value}T12:00:00`);
        if (Number.isNaN(date.getTime())) {
            throw new BadRequestException('Invalid schedule date.');
        }
        date.setMonth(date.getMonth() + months);
        return date.toISOString().slice(0, 10);
    }

    private frequencyMonths(frequency: AccountingLoanRepaymentFrequency): number {
        return frequency === AccountingLoanRepaymentFrequency.QUARTERLY ? 3 : 1;
    }

    private installmentCount(durationMonths: number, frequency: AccountingLoanRepaymentFrequency): number {
        return Math.max(1, Math.ceil(durationMonths / this.frequencyMonths(frequency)));
    }

    private deriveRepaymentStatus(row: Pick<AccountingLoanRepayment, 'status' | 'due_date' | 'paid_amount' | 'total_due_amount'>): AccountingLoanRepaymentStatus {
        if (this.roundMoney(Number(row.paid_amount ?? 0)) >= this.roundMoney(Number(row.total_due_amount ?? 0))) {
            return AccountingLoanRepaymentStatus.PAID;
        }
        const today = new Date().toISOString().slice(0, 10);
        return row.due_date < today ? AccountingLoanRepaymentStatus.OVERDUE : AccountingLoanRepaymentStatus.DUE;
    }

    private async assertBranchBelongsToClient(clientId: string, branchId: number, accessibleBranchIds?: number[]) {
        if (accessibleBranchIds?.length && !accessibleBranchIds.includes(branchId)) {
            throw new BadRequestException(`Branch ${branchId} is not available for this user.`);
        }
        const branch = await this.branchRepo.findOne({ where: { id: branchId, client_id: clientId } });
        if (!branch) {
            throw new NotFoundException(`Branch ${branchId} not found.`);
        }
        return branch;
    }

    private async resolveTreasuryAccount(clientId: string, branchId: number, treasuryAccountId: number) {
        const account = await this.coaRepo.findOne({ where: { id: treasuryAccountId, client_id: clientId } });
        if (!account) {
            throw new NotFoundException(`Treasury account ${treasuryAccountId} not found.`);
        }
        if (!account.is_cash_account && !account.is_bank_account) {
            throw new BadRequestException(`Account ${account.account_code} is not a cash or bank treasury account.`);
        }
        if (account.scope === 'branch' && account.branch_id && Number(account.branch_id) !== Number(branchId)) {
            throw new BadRequestException('Selected treasury account is not available for this branch.');
        }
        return account;
    }

    private async resolveLoanPostingAccounts(clientId: string, loan: AccountingLoan) {
        const liabilityAccount = loan.liability_account_id
            ? await this.coaRepo.findOne({ where: { id: loan.liability_account_id, client_id: clientId } })
            : await this.accountingService.ensureDefaultAccount(clientId, loan.duration_months > 12 ? '2500' : '2170', loan.duration_months > 12 ? 'Long-Term Loans' : 'Short-Term Loans', 'liability');
        const interestExpenseAccount = loan.interest_expense_account_id
            ? await this.coaRepo.findOne({ where: { id: loan.interest_expense_account_id, client_id: clientId } })
            : await this.accountingService.ensureDefaultAccount(clientId, '5630', 'Loan Interest Expense', 'expense');
        if (!liabilityAccount || !interestExpenseAccount) {
            throw new BadRequestException('Loan posting accounts are not configured correctly.');
        }
        return { liabilityAccount, interestExpenseAccount };
    }

    private buildSchedule(dto: {
        principal_amount: number;
        annual_interest_rate: number;
        interest_method: AccountingLoanInterestMethod;
        start_date: string;
        duration_months: number;
        repayment_frequency: AccountingLoanRepaymentFrequency;
    }) {
        const principal = this.roundMoney(Number(dto.principal_amount));
        const annualRate = Number(dto.annual_interest_rate) / 100;
        const intervalMonths = this.frequencyMonths(dto.repayment_frequency);
        const installmentCount = this.installmentCount(dto.duration_months, dto.repayment_frequency);
        const periodRate = annualRate * (intervalMonths / 12);
        let outstanding = principal;
        const rows: Array<{
            installment_no: number;
            due_date: string;
            principal_amount: number;
            interest_amount: number;
            total_due_amount: number;
            balance_after_amount: number;
        }> = [];

        let fixedInstallmentAmount = 0;
        if (dto.interest_method === AccountingLoanInterestMethod.REDUCING && periodRate > 0) {
            fixedInstallmentAmount = this.roundMoney(
                principal * (periodRate / (1 - (1 + periodRate) ** (-installmentCount))),
            );
        } else if (dto.interest_method === AccountingLoanInterestMethod.REDUCING) {
            fixedInstallmentAmount = this.roundMoney(principal / installmentCount);
        }

        const flatPeriodInterest = this.roundMoney(principal * annualRate * (intervalMonths / 12));

        for (let index = 0; index < installmentCount; index += 1) {
            const dueDate = this.addMonths(dto.start_date, intervalMonths * (index + 1));
            let interestAmount = 0;
            let principalAmount = 0;

            if (dto.interest_method === AccountingLoanInterestMethod.FLAT) {
                interestAmount = index === installmentCount - 1
                    ? this.roundMoney(
                        this.roundMoney(principal * annualRate * (dto.duration_months / 12))
                        - rows.reduce((sum, row) => sum + row.interest_amount, 0),
                    )
                    : flatPeriodInterest;
                principalAmount = index === installmentCount - 1
                    ? this.roundMoney(outstanding)
                    : this.roundMoney(principal / installmentCount);
            } else {
                interestAmount = this.roundMoney(outstanding * periodRate);
                principalAmount = index === installmentCount - 1
                    ? this.roundMoney(outstanding)
                    : this.roundMoney(fixedInstallmentAmount - interestAmount);
            }

            outstanding = this.roundMoney(Math.max(outstanding - principalAmount, 0));
            rows.push({
                installment_no: index + 1,
                due_date: dueDate,
                principal_amount: principalAmount,
                interest_amount: interestAmount,
                total_due_amount: this.roundMoney(principalAmount + interestAmount),
                balance_after_amount: outstanding,
            });
        }

        return {
            installment_count: installmentCount,
            installment_amount: this.roundMoney(rows[0]?.total_due_amount ?? 0),
            maturity_date: rows[rows.length - 1]?.due_date ?? dto.start_date,
            next_due_date: rows[0]?.due_date ?? null,
            rows,
        };
    }

    private async generateLoanCode(clientId: string) {
        const latest = await this.loanRepo.findOne({
            where: { client_id: clientId },
            order: { id: 'DESC' },
        });
        return `LN-${String((latest?.id ?? 0) + 1).padStart(4, '0')}`;
    }

    async listLoans(clientId: string, query: ListLoanQueryDto, accessibleBranchIds?: number[]) {
        const qb = this.loanRepo.createQueryBuilder('loan')
            .leftJoinAndSelect('loan.branch', 'branch')
            .where('loan.client_id = :clientId', { clientId });

        if (accessibleBranchIds?.length) {
            qb.andWhere('loan.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }
        if (query.branch_id) {
            qb.andWhere('loan.branch_id = :branchId', { branchId: query.branch_id });
        }
        if (query.status) {
            qb.andWhere('loan.status = :status', { status: query.status });
        }
        if (query.search?.trim()) {
            qb.andWhere('(loan.loan_code LIKE :search OR loan.source_name LIKE :search)', { search: `%${query.search.trim()}%` });
        }

        const loans = await qb.orderBy('loan.created_at', 'DESC').getMany();
        if (loans.length === 0) {
            return [];
        }

        const repaymentRows = await this.repaymentRepo.find({
            where: { client_id: clientId, loan_id: In(loans.map((loan) => loan.id)) },
            order: { due_date: 'ASC', installment_no: 'ASC' },
        });
        const repaymentsByLoan = new Map<number, AccountingLoanRepayment[]>();
        for (const repayment of repaymentRows) {
            const current = repaymentsByLoan.get(repayment.loan_id) ?? [];
            current.push(repayment);
            repaymentsByLoan.set(repayment.loan_id, current);
        }

        return loans.map((loan) => {
            const schedule = repaymentsByLoan.get(loan.id) ?? [];
            const totalPaid = this.roundMoney(schedule.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0));
            const nextOpen = schedule.find((row) => this.deriveRepaymentStatus(row) !== AccountingLoanRepaymentStatus.PAID) ?? null;
            return {
                id: loan.id,
                loan_code: loan.loan_code,
                source_name: loan.source_name,
                branch_id: loan.branch_id,
                branch_name: loan.branch?.branch_name ?? null,
                principal_amount: this.roundMoney(Number(loan.principal_amount ?? 0)),
                annual_interest_rate: Number(loan.annual_interest_rate ?? 0),
                interest_method: loan.interest_method,
                start_date: loan.start_date,
                duration_months: loan.duration_months,
                repayment_frequency: loan.repayment_frequency,
                installment_count: loan.installment_count,
                installment_amount: this.roundMoney(Number(loan.installment_amount ?? 0)),
                maturity_date: loan.maturity_date,
                outstanding_principal_amount: this.roundMoney(Number(loan.outstanding_principal_amount ?? 0)),
                total_paid_amount: totalPaid,
                next_due_date: nextOpen?.due_date ?? null,
                next_payment_amount: nextOpen ? this.roundMoney(Number(nextOpen.total_due_amount ?? 0) - Number(nextOpen.paid_amount ?? 0)) : 0,
                status: loan.status,
                notes: loan.notes,
            };
        });
    }

    async createLoan(clientId: string, dto: CreateLoanDto, accessibleBranchIds?: number[], user?: JwtPayload) {
        const branch = await this.assertBranchBelongsToClient(clientId, dto.branch_id, accessibleBranchIds);
        await this.accountingService.assertPeriodUnlockedForOperation(clientId, dto.branch_id, dto.start_date, 'Loan disbursement', user);

        const treasuryAccount = await this.resolveTreasuryAccount(clientId, dto.branch_id, dto.disbursement_account_id);
        const liabilityAccount = await this.accountingService.ensureDefaultAccount(
            clientId,
            dto.duration_months > 12 ? '2500' : '2170',
            dto.duration_months > 12 ? 'Long-Term Loans' : 'Short-Term Loans',
            'liability',
        );
        const interestExpenseAccount = await this.accountingService.ensureDefaultAccount(
            clientId,
            '5630',
            'Loan Interest Expense',
            'expense',
        );

        const schedule = this.buildSchedule(dto);
        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const loanCode = await this.generateLoanCode(clientId);

        const journal = await this.accountingService.createJournalEntry(clientId, dto.branch_id, {
            branch_id: dto.branch_id,
            transaction_date: new Date(`${dto.start_date}T12:00:00`),
            business_date: dto.start_date,
            description: `Loan disbursement ${loanCode} - ${dto.source_name}`,
            reference_id: dto.disbursement_reference_no?.trim() || loanCode,
            source_module: 'accounting',
            source_entity_type: 'loan',
            source_entity_id: loanCode,
            source_event: 'loan_disbursement',
            posting_type: 'auto',
            items: [
                { account_id: treasuryAccount.id, debit: this.roundMoney(dto.principal_amount), credit: 0 },
                { account_id: liabilityAccount.id, debit: 0, credit: this.roundMoney(dto.principal_amount) },
            ],
        }, user);

        const loan = await this.loanRepo.save(this.loanRepo.create({
            client_id: clientId,
            branch_id: dto.branch_id,
            loan_code: loanCode,
            source_name: dto.source_name.trim(),
            principal_amount: this.roundMoney(dto.principal_amount),
            annual_interest_rate: dto.annual_interest_rate,
            interest_method: dto.interest_method,
            start_date: dto.start_date,
            duration_months: dto.duration_months,
            repayment_frequency: dto.repayment_frequency,
            installment_count: schedule.installment_count,
            installment_amount: schedule.installment_amount,
            maturity_date: schedule.maturity_date,
            next_due_date: schedule.next_due_date,
            outstanding_principal_amount: this.roundMoney(dto.principal_amount),
            total_paid_amount: 0,
            status: AccountingLoanStatus.ACTIVE,
            disbursement_reference_no: dto.disbursement_reference_no?.trim() || null,
            disbursement_account_id: treasuryAccount.id,
            liability_account_id: liabilityAccount.id,
            interest_expense_account_id: interestExpenseAccount.id,
            disbursement_journal_entry_id: journal.id,
            notes: dto.notes?.trim() || null,
            created_by: actorUserId,
            updated_by: actorUserId,
        }));

        await this.repaymentRepo.save(schedule.rows.map((row) => this.repaymentRepo.create({
            client_id: clientId,
            loan_id: loan.id,
            branch_id: dto.branch_id,
            installment_no: row.installment_no,
            due_date: row.due_date,
            principal_amount: row.principal_amount,
            interest_amount: row.interest_amount,
            total_due_amount: row.total_due_amount,
            principal_paid_amount: 0,
            interest_paid_amount: 0,
            paid_amount: 0,
            paid_date: null,
            balance_after_amount: row.balance_after_amount,
            status: AccountingLoanRepaymentStatus.DUE,
            created_by: actorUserId,
            updated_by: actorUserId,
        })));

        return this.listLoans(clientId, { branch_id: branch.id, search: loanCode }, accessibleBranchIds).then((rows) => rows[0]);
    }

    async updateLoan(clientId: string, id: number, dto: UpdateLoanDto, accessibleBranchIds?: number[], user?: JwtPayload) {
        const loan = await this.loanRepo.findOne({ where: { id, client_id: clientId } });
        if (!loan) {
            throw new NotFoundException('Loan not found');
        }
        await this.assertBranchBelongsToClient(clientId, loan.branch_id, accessibleBranchIds);

        const repayments = await this.repaymentRepo.find({
            where: { client_id: clientId, loan_id: id },
            order: { installment_no: 'ASC' },
        });
        const hasPaidInstallments = repayments.some((row) => this.roundMoney(Number(row.paid_amount ?? 0)) > 0);
        const scheduleFieldsChanged = dto.principal_amount !== undefined
            || dto.annual_interest_rate !== undefined
            || dto.interest_method !== undefined
            || dto.start_date !== undefined
            || dto.duration_months !== undefined
            || dto.repayment_frequency !== undefined;

        if (scheduleFieldsChanged && hasPaidInstallments) {
            throw new BadRequestException('Loan terms cannot be changed after repayments have been posted.');
        }

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;

        loan.source_name = dto.source_name?.trim() || loan.source_name;
        loan.notes = dto.notes !== undefined ? (dto.notes?.trim() || null) : loan.notes;
        loan.status = dto.status ?? loan.status;

        if (scheduleFieldsChanged) {
            const nextShape = {
                principal_amount: dto.principal_amount ?? Number(loan.principal_amount),
                annual_interest_rate: dto.annual_interest_rate ?? Number(loan.annual_interest_rate),
                interest_method: dto.interest_method ?? loan.interest_method,
                start_date: dto.start_date ?? loan.start_date,
                duration_months: dto.duration_months ?? loan.duration_months,
                repayment_frequency: dto.repayment_frequency ?? loan.repayment_frequency,
            };
            const schedule = this.buildSchedule(nextShape);
            loan.principal_amount = nextShape.principal_amount;
            loan.annual_interest_rate = nextShape.annual_interest_rate;
            loan.interest_method = nextShape.interest_method;
            loan.start_date = nextShape.start_date;
            loan.duration_months = nextShape.duration_months;
            loan.repayment_frequency = nextShape.repayment_frequency;
            loan.installment_count = schedule.installment_count;
            loan.installment_amount = schedule.installment_amount;
            loan.maturity_date = schedule.maturity_date;
            loan.next_due_date = schedule.next_due_date;
            loan.outstanding_principal_amount = this.roundMoney(nextShape.principal_amount);
            loan.total_paid_amount = 0;

            await this.repaymentRepo.delete({ client_id: clientId, loan_id: loan.id });
            await this.repaymentRepo.save(schedule.rows.map((row) => this.repaymentRepo.create({
                client_id: clientId,
                loan_id: loan.id,
                branch_id: loan.branch_id,
                installment_no: row.installment_no,
                due_date: row.due_date,
                principal_amount: row.principal_amount,
                interest_amount: row.interest_amount,
                total_due_amount: row.total_due_amount,
                principal_paid_amount: 0,
                interest_paid_amount: 0,
                paid_amount: 0,
                paid_date: null,
                balance_after_amount: row.balance_after_amount,
                status: AccountingLoanRepaymentStatus.DUE,
                created_by: actorUserId,
                updated_by: actorUserId,
            })));
        }

        loan.updated_by = actorUserId;
        await this.loanRepo.save(loan);
        return this.listLoans(clientId, { branch_id: loan.branch_id, search: loan.loan_code }, accessibleBranchIds).then((rows) => rows[0]);
    }

    async listRepayments(clientId: string, query: ListLoanRepaymentQueryDto, accessibleBranchIds?: number[]) {
        const qb = this.repaymentRepo.createQueryBuilder('repayment')
            .leftJoinAndSelect('repayment.loan', 'loan')
            .leftJoinAndSelect('repayment.branch', 'branch')
            .where('repayment.client_id = :clientId', { clientId });

        if (accessibleBranchIds?.length) {
            qb.andWhere('repayment.branch_id IN (:...accessibleBranchIds)', { accessibleBranchIds });
        }
        if (query.branch_id) {
            qb.andWhere('repayment.branch_id = :branchId', { branchId: query.branch_id });
        }
        if (query.loan_id) {
            qb.andWhere('repayment.loan_id = :loanId', { loanId: query.loan_id });
        }

        const rows = await qb.orderBy('repayment.due_date', 'ASC').addOrderBy('repayment.installment_no', 'ASC').getMany();
        return rows
            .map((row) => {
                const status = this.deriveRepaymentStatus(row);
                return {
                    id: row.id,
                    loan_id: row.loan_id,
                    loan_code: row.loan?.loan_code ?? null,
                    source_name: row.loan?.source_name ?? null,
                    branch_id: row.branch_id,
                    branch_name: row.branch?.branch_name ?? null,
                    installment_no: row.installment_no,
                    due_date: row.due_date,
                    principal_amount: this.roundMoney(Number(row.principal_amount ?? 0)),
                    interest_amount: this.roundMoney(Number(row.interest_amount ?? 0)),
                    total_due_amount: this.roundMoney(Number(row.total_due_amount ?? 0)),
                    paid_amount: this.roundMoney(Number(row.paid_amount ?? 0)),
                    paid_date: row.paid_date,
                    balance_after_amount: this.roundMoney(Number(row.balance_after_amount ?? 0)),
                    remaining_due_amount: this.roundMoney(Number(row.total_due_amount ?? 0) - Number(row.paid_amount ?? 0)),
                    status,
                };
            })
            .filter((row) => !query.status || row.status === query.status);
    }

    async recordRepayment(clientId: string, dto: RecordLoanRepaymentDto, accessibleBranchIds?: number[], user?: JwtPayload) {
        const repayment = await this.repaymentRepo.findOne({
            where: { id: dto.repayment_id, client_id: clientId },
            relations: ['loan'],
        });
        if (!repayment || !repayment.loan) {
            throw new NotFoundException('Loan repayment schedule row not found.');
        }
        await this.assertBranchBelongsToClient(clientId, repayment.branch_id, accessibleBranchIds);
        await this.accountingService.assertPeriodUnlockedForOperation(clientId, repayment.branch_id, dto.payment_date, 'Loan repayment', user);

        const loan = repayment.loan;
        if ([AccountingLoanStatus.CLOSED].includes(loan.status)) {
            throw new BadRequestException('Closed loans cannot receive repayments.');
        }

        const treasuryAccount = await this.resolveTreasuryAccount(clientId, repayment.branch_id, dto.treasury_account_id);
        const remainingDue = this.roundMoney(Number(repayment.total_due_amount ?? 0) - Number(repayment.paid_amount ?? 0));
        if (remainingDue <= 0) {
            throw new BadRequestException('This installment is already fully paid.');
        }
        const amountPaid = this.roundMoney(dto.amount_paid);
        if (amountPaid > remainingDue) {
            throw new BadRequestException(`Amount exceeds the remaining due of ${remainingDue.toFixed(2)}.`);
        }

        const remainingInterest = this.roundMoney(Number(repayment.interest_amount ?? 0) - Number(repayment.interest_paid_amount ?? 0));
        const interestPaid = this.roundMoney(Math.min(amountPaid, remainingInterest));
        const principalPaid = this.roundMoney(amountPaid - interestPaid);

        const { liabilityAccount, interestExpenseAccount } = await this.resolveLoanPostingAccounts(clientId, loan);

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const journal = await this.accountingService.createJournalEntry(clientId, repayment.branch_id, {
            branch_id: repayment.branch_id,
            transaction_date: new Date(`${dto.payment_date}T12:00:00`),
            business_date: dto.payment_date,
            description: `Loan repayment ${loan.loan_code} installment ${repayment.installment_no}`,
            reference_id: dto.reference_no?.trim() || `${loan.loan_code}-${repayment.installment_no}`,
            source_module: 'accounting',
            source_entity_type: 'loan_repayment',
            source_entity_id: String(repayment.id),
            source_event: 'loan_repayment',
            posting_type: 'auto',
            items: [
                ...(principalPaid > 0 ? [{ account_id: liabilityAccount.id, debit: principalPaid, credit: 0 }] : []),
                ...(interestPaid > 0 ? [{ account_id: interestExpenseAccount.id, debit: interestPaid, credit: 0 }] : []),
                { account_id: treasuryAccount.id, debit: 0, credit: amountPaid },
            ],
        }, user);

        repayment.principal_paid_amount = this.roundMoney(Number(repayment.principal_paid_amount ?? 0) + principalPaid);
        repayment.interest_paid_amount = this.roundMoney(Number(repayment.interest_paid_amount ?? 0) + interestPaid);
        repayment.paid_amount = this.roundMoney(Number(repayment.paid_amount ?? 0) + amountPaid);
        repayment.paid_date = this.roundMoney(Number(repayment.paid_amount ?? 0)) >= this.roundMoney(Number(repayment.total_due_amount ?? 0))
            ? (repayment.paid_date ?? dto.payment_date)
            : dto.payment_date;
        repayment.payment_method = dto.payment_method;
        repayment.treasury_account_id = treasuryAccount.id;
        repayment.reference_no = dto.reference_no?.trim() || null;
        repayment.notes = dto.notes?.trim() || null;
        repayment.journal_entry_id = journal.id;
        repayment.status = this.deriveRepaymentStatus(repayment);
        repayment.updated_by = actorUserId;
        await this.repaymentRepo.save(repayment);

        loan.outstanding_principal_amount = this.roundMoney(Math.max(Number(loan.outstanding_principal_amount ?? 0) - principalPaid, 0));
        loan.total_paid_amount = this.roundMoney(Number(loan.total_paid_amount ?? 0) + amountPaid);

        const futureRows = await this.repaymentRepo.find({
            where: { client_id: clientId, loan_id: loan.id },
            order: { due_date: 'ASC', installment_no: 'ASC' },
        });
        const nextOpen = futureRows.find((row) => this.deriveRepaymentStatus(row) !== AccountingLoanRepaymentStatus.PAID) ?? null;
        loan.next_due_date = nextOpen?.due_date ?? null;
        if (!nextOpen && loan.outstanding_principal_amount <= 0.009) {
            loan.status = AccountingLoanStatus.COMPLETED;
        }
        loan.updated_by = actorUserId;
        await this.loanRepo.save(loan);

        return this.listRepayments(clientId, { loan_id: loan.id }, accessibleBranchIds).then((rows) =>
            rows.find((row) => Number(row.id) === Number(repayment.id)),
        );
    }

    async settleLoan(clientId: string, dto: SettleLoanDto, accessibleBranchIds?: number[], user?: JwtPayload) {
        const loan = await this.loanRepo.findOne({ where: { id: dto.loan_id, client_id: clientId } });
        if (!loan) {
            throw new NotFoundException('Loan not found');
        }
        await this.assertBranchBelongsToClient(clientId, loan.branch_id, accessibleBranchIds);
        await this.accountingService.assertPeriodUnlockedForOperation(clientId, loan.branch_id, dto.payment_date, 'Loan settlement', user);

        if ([AccountingLoanStatus.CLOSED].includes(loan.status)) {
            throw new BadRequestException('Closed loans cannot be settled.');
        }

        const repaymentRows = await this.repaymentRepo.find({
            where: { client_id: clientId, loan_id: loan.id },
            order: { due_date: 'ASC', installment_no: 'ASC' },
        });
        const openRows = repaymentRows.filter((row) => this.roundMoney(Number(row.total_due_amount ?? 0) - Number(row.paid_amount ?? 0)) > 0);
        if (openRows.length === 0) {
            throw new BadRequestException('This loan is already fully settled.');
        }

        const treasuryAccount = await this.resolveTreasuryAccount(clientId, loan.branch_id, dto.treasury_account_id);
        const { liabilityAccount, interestExpenseAccount } = await this.resolveLoanPostingAccounts(clientId, loan);

        const principalPaid = this.roundMoney(openRows.reduce(
            (sum, row) => sum + this.roundMoney(Number(row.principal_amount ?? 0) - Number(row.principal_paid_amount ?? 0)),
            0,
        ));
        const interestPaid = this.roundMoney(openRows.reduce(
            (sum, row) => sum + this.roundMoney(Number(row.interest_amount ?? 0) - Number(row.interest_paid_amount ?? 0)),
            0,
        ));
        const amountPaid = this.roundMoney(principalPaid + interestPaid);
        if (amountPaid <= 0) {
            throw new BadRequestException('This loan has no remaining amount to settle.');
        }

        const actorId = resolveActorId(user);
        const actorUserId = actorId && Number.isInteger(Number(actorId)) ? Number(actorId) : null;
        const journal = await this.accountingService.createJournalEntry(clientId, loan.branch_id, {
            branch_id: loan.branch_id,
            transaction_date: new Date(`${dto.payment_date}T12:00:00`),
            business_date: dto.payment_date,
            description: `Loan settlement ${loan.loan_code} - ${loan.source_name}`,
            reference_id: dto.reference_no?.trim() || `${loan.loan_code}-SETTLEMENT`,
            source_module: 'accounting',
            source_entity_type: 'loan_settlement',
            source_entity_id: String(loan.id),
            source_event: 'loan_settlement',
            posting_type: 'auto',
            items: [
                ...(principalPaid > 0 ? [{ account_id: liabilityAccount.id, debit: principalPaid, credit: 0 }] : []),
                ...(interestPaid > 0 ? [{ account_id: interestExpenseAccount.id, debit: interestPaid, credit: 0 }] : []),
                { account_id: treasuryAccount.id, debit: 0, credit: amountPaid },
            ],
        }, user);

        for (const row of openRows) {
            row.principal_paid_amount = this.roundMoney(Number(row.principal_amount ?? 0));
            row.interest_paid_amount = this.roundMoney(Number(row.interest_amount ?? 0));
            row.paid_amount = this.roundMoney(Number(row.total_due_amount ?? 0));
            row.paid_date = dto.payment_date;
            row.payment_method = dto.payment_method;
            row.treasury_account_id = treasuryAccount.id;
            row.reference_no = dto.reference_no?.trim() || null;
            row.notes = dto.notes?.trim() || null;
            row.journal_entry_id = journal.id;
            row.status = AccountingLoanRepaymentStatus.PAID;
            row.updated_by = actorUserId;
        }
        await this.repaymentRepo.save(openRows);

        loan.outstanding_principal_amount = this.roundMoney(Math.max(Number(loan.outstanding_principal_amount ?? 0) - principalPaid, 0));
        loan.total_paid_amount = this.roundMoney(Number(loan.total_paid_amount ?? 0) + amountPaid);
        loan.next_due_date = null;
        loan.status = loan.outstanding_principal_amount <= 0.009 ? AccountingLoanStatus.COMPLETED : loan.status;
        loan.updated_by = actorUserId;
        await this.loanRepo.save(loan);

        return this.listLoans(clientId, { branch_id: loan.branch_id, search: loan.loan_code }, accessibleBranchIds).then((rows) => rows[0]);
    }
}
