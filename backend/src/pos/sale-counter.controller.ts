import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
} from '@nestjs/common';
import { SaleCounterService } from './sale-counter.service';
import { CreateSaleCounterDto } from './dto/create-sale-counter.dto';
import { UpdateSaleCounterDto } from './dto/update-sale-counter.dto';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { RequireFeature } from '../auth/decorators/feature-entitlement.decorator';
import { RequestUser } from '../auth/decorators/user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../auth/payloads/jwt-payload.interface';
import {
    getAccessibleBranchIds,
    getOptionalBranchId,
    requireBranchId,
    requireClientId,
} from '../auth/request-context.util';

@Controller('v1/pos/sale-counters')
@RequireFeature('pos', 'POS sale counter management')
export class SaleCounterController {
    constructor(private readonly service: SaleCounterService) {}

    @Post()
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
    create(@Body() createDto: CreateSaleCounterDto, @RequestUser() user: JwtPayload) {
        const branchId = requireBranchId(user, createDto.branch_id);
        return this.service.create({ ...createDto, branch_id: branchId }, requireClientId(user));
    }

    @Get()
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
    findAll(@RequestUser() user: JwtPayload, @Query('branch_id') branch_id?: number) {
        return this.service.findAll(
            requireClientId(user),
            getOptionalBranchId(user, branch_id),
            getAccessibleBranchIds(user),
        );
    }

    @Get(':id')
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
    findOne(@Param('id') id: string, @RequestUser() user: JwtPayload) {
        return this.service.findOne(+id, requireClientId(user), getAccessibleBranchIds(user));
    }

    @Patch(':id')
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
    update(
        @Param('id') id: string,
        @Body() updateDto: UpdateSaleCounterDto,
        @RequestUser() user: JwtPayload,
    ) {
        const branchId = updateDto.branch_id ? requireBranchId(user, updateDto.branch_id) : undefined;
        return this.service.update(
            +id,
            { ...updateDto, branch_id: branchId },
            requireClientId(user),
            getAccessibleBranchIds(user),
        );
    }

    @Delete(':id')
    @RequirePermissions(APP_PERMISSIONS.ADMIN.SETUP_BRANCHES)
    remove(@Param('id') id: string, @RequestUser() user: JwtPayload) {
        return this.service.remove(+id, requireClientId(user), getAccessibleBranchIds(user));
    }
}
