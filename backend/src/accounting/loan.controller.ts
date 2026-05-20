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
import { getAccessibleBranchIds, getOptionalBranchId, requireClientId } from '../auth/request-context.util';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
    CreateLoanDto,
    ListLoanQueryDto,
    ListLoanRepaymentQueryDto,
    RecordLoanRepaymentDto,
    SettleLoanDto,
    UpdateLoanDto,
} from './dto/loan.dto';
import { AccountingLoanService } from './loan.service';

@Controller('v1/accounting')
@UseGuards(JwtAuthGuard)
export class AccountingLoanController {
    constructor(private readonly loanService: AccountingLoanService) {}

    @Get('loans')
    @RequireAnyPermissions(APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW, APP_PERMISSIONS.ACCOUNTING.LOANS)
    async listLoans(@RequestUser() user: JwtPayload, @Query() query: ListLoanQueryDto) {
        return this.loanService.listLoans(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id),
        }, getAccessibleBranchIds(user));
    }

    @Post('loans')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.LOANS)
    async createLoan(@RequestUser() user: JwtPayload, @Body() body: CreateLoanDto) {
        return this.loanService.createLoan(requireClientId(user), body, getAccessibleBranchIds(user), user);
    }

    @Patch('loans/:id')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.LOANS)
    async updateLoan(
        @RequestUser() user: JwtPayload,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateLoanDto,
    ) {
        return this.loanService.updateLoan(requireClientId(user), id, body, getAccessibleBranchIds(user), user);
    }

    @Get('loan-repayments')
    @RequireAnyPermissions(APP_PERMISSIONS.ACCOUNTING.LOANS_VIEW, APP_PERMISSIONS.ACCOUNTING.LOANS)
    async listRepayments(@RequestUser() user: JwtPayload, @Query() query: ListLoanRepaymentQueryDto) {
        return this.loanService.listRepayments(requireClientId(user), {
            ...query,
            branch_id: getOptionalBranchId(user, query.branch_id),
        }, getAccessibleBranchIds(user));
    }

    @Post('loan-repayments')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.LOANS)
    async recordRepayment(@RequestUser() user: JwtPayload, @Body() body: RecordLoanRepaymentDto) {
        return this.loanService.recordRepayment(requireClientId(user), body, getAccessibleBranchIds(user), user);
    }

    @Post('loans/settle')
    @RequirePermissions(APP_PERMISSIONS.ACCOUNTING.LOANS)
    async settleLoan(@RequestUser() user: JwtPayload, @Body() body: SettleLoanDto) {
        return this.loanService.settleLoan(requireClientId(user), body, getAccessibleBranchIds(user), user);
    }
}
