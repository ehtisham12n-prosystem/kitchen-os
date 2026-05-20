import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
    USER_APPROVAL_AUTHORITIES,
    USER_BRANCH_ASSIGNMENT_SCOPES,
} from '../user-governance.constants';

export class BranchAssignmentDto {
    @Type(() => Number)
    @IsInt()
    branchId: number;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    roleId?: number;

    @Type(() => Number)
    @IsInt({ each: true })
    @IsOptional()
    roleIds?: number[];

    @IsOptional()
    @IsBoolean()
    isPrimary?: boolean;

    @IsOptional()
    @IsIn(USER_BRANCH_ASSIGNMENT_SCOPES)
    assignmentScope?: (typeof USER_BRANCH_ASSIGNMENT_SCOPES)[number];

    @IsOptional()
    @IsIn(USER_APPROVAL_AUTHORITIES)
    approvalAuthority?: (typeof USER_APPROVAL_AUTHORITIES)[number];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    directPermissions?: string[];
}

export class AssignBranchesDto {
    @ArrayUnique((assignment: BranchAssignmentDto) => assignment.branchId)
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BranchAssignmentDto)
    branchAssignments: BranchAssignmentDto[];
}
