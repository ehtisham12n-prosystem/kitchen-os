import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireAnyPermissions, RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getOptionalBranchId, requireClientId } from '../auth/request-context.util';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
    CreateInvestorAgreementDto,
    CreateInvestorDto,
    CreateInvestorTransactionDto,
    InvestorStatementQueryDto,
    ListAgreementQueryDto,
    ListInvestorQueryDto,
    ListInvestorTransactionQueryDto,
    ListProfitDistributionQueryDto,
    ProcessProfitDistributionDto,
    ProfitDistributionPreviewQueryDto,
    ReturnInvestorCapitalDto,
    UpdateInvestorAgreementDto,
    UpdateInvestorDto,
} from './dto/investor-profit.dto';
import { InvestorProfitService } from './investor-profit.service';

@Controller('v1/accounting')
@UseGuards(JwtAuthGuard)
export class InvestorProfitController {
    constructor(private readonly investorProfitService: InvestorProfitService) {}

    @Get('investors')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW,
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
    )
    async listInvestors(@RequestUser() user: JwtPayload, @Query() query: ListInvestorQueryDto) {
        return this.investorProfitService.listInvestors(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id),
        });
    }

    @Post('investors')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async createInvestor(@RequestUser() user: JwtPayload, @Body() body: CreateInvestorDto) {
        return this.investorProfitService.createInvestor(requireClientId(user), body);
    }

    @Patch('investors/:id')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async updateInvestor(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateInvestorDto,
    ) {
        return this.investorProfitService.updateInvestor(requireClientId(user), id, body);
    }

    @Get('investors/:id/statement')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW,
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.REPORTS,
    )
    async getInvestorStatement(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Query() query: InvestorStatementQueryDto,
    ) {
        return this.investorProfitService.getInvestorStatement(
            requireClientId(user),
            id,
            getOptionalBranchId(user, query.branch_id),
            query.period_start,
            query.period_end,
        );
    }

    @Get('investor-agreements')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW,
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
    )
    async listAgreements(@RequestUser() user: JwtPayload, @Query() query: ListAgreementQueryDto) {
        return this.investorProfitService.listAgreements(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id),
        });
    }

    @Post('investor-agreements')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async createAgreement(@RequestUser() user: JwtPayload, @Body() body: CreateInvestorAgreementDto) {
        return this.investorProfitService.createAgreement(requireClientId(user), {
            ...body,
            branch_id: getOptionalBranchId(user, body.branch_id) ?? body.branch_id,
        }, user);
    }

    @Patch('investor-agreements/:id')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async updateAgreement(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateInvestorAgreementDto,
    ) {
        return this.investorProfitService.updateAgreement(requireClientId(user), id, {
            ...body,
            branch_id: getOptionalBranchId(user, body.branch_id) ?? body.branch_id,
        });
    }

    @Get('investor-transactions')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS_VIEW,
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
    )
    async listTransactions(@RequestUser() user: JwtPayload, @Query() query: ListInvestorTransactionQueryDto) {
        return this.investorProfitService.listTransactions(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id),
        });
    }

    @Post('investor-transactions')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async createTransaction(@RequestUser() user: JwtPayload, @Body() body: CreateInvestorTransactionDto) {
        return this.investorProfitService.createTransaction(requireClientId(user), {
            ...body,
            branch_id: getOptionalBranchId(user, body.branch_id) ?? body.branch_id,
        }, user);
    }

    @Post('investor-transactions/return-capital')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.INVESTORS,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async returnCapital(@RequestUser() user: JwtPayload, @Body() body: ReturnInvestorCapitalDto) {
        return this.investorProfitService.returnCapital(requireClientId(user), {
            ...body,
            branch_id: getOptionalBranchId(user, body.branch_id) ?? body.branch_id,
        }, user);
    }

    @Get('profit-distributions/preview')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW,
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
        APP_PERMISSIONS.ACCOUNTING.REPORTS,
    )
    async previewDistribution(@RequestUser() user: JwtPayload, @Query() query: ProfitDistributionPreviewQueryDto) {
        return this.investorProfitService.previewProfitDistribution(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id) ?? query.branch_id,
        });
    }

    @Post('profit-distributions/process')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
        APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE,
    )
    async processDistribution(@RequestUser() user: JwtPayload, @Body() body: ProcessProfitDistributionDto) {
        return this.investorProfitService.processProfitDistribution(requireClientId(user), {
            ...body,
            branch_id: getOptionalBranchId(user, body.branch_id) ?? body.branch_id,
        }, user);
    }

    @Get('profit-distributions')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW,
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
    )
    async listDistributionHistory(@RequestUser() user: JwtPayload, @Query() query: ListProfitDistributionQueryDto) {
        return this.investorProfitService.listProfitDistributions(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id),
        });
    }

    @Get('profit-distributions/:id')
    @RequireAnyPermissions(
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION_VIEW,
        APP_PERMISSIONS.ACCOUNTING.PROFIT_DISTRIBUTION,
    )
    async getDistributionBatch(@RequestUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
        return this.investorProfitService.getDistributionBatch(requireClientId(user), id);
    }
}
