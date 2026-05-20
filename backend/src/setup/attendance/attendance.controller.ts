import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { APP_PERMISSIONS } from '../../auth/constants/permissions';
import { RequestUser } from '../../auth/decorators/user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { JwtPayload } from '../../auth/payloads/jwt-payload.interface';
import { getAccessibleBranchIds, requireClientId } from '../../auth/request-context.util';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { LockAttendanceDto } from './dto/lock-attendance.dto';

@Controller('v1/setup/attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  list(
    @RequestUser() user: JwtPayload,
    @Query('branch_id') branchId?: number,
    @Query('department_id') departmentId?: number,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('search') search?: string,
  ) {
    return this.attendanceService.list(requireClientId(user), getAccessibleBranchIds(user), {
      branch_id: branchId ? Number(branchId) : undefined,
      department_id: departmentId ? Number(departmentId) : undefined,
      date_from: dateFrom,
      date_to: dateTo,
      search,
    });
  }

  @Get('roster')
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  roster(
    @RequestUser() user: JwtPayload,
    @Query('branch_id') branchId?: number,
  ) {
    return this.attendanceService.roster(
      requireClientId(user),
      getAccessibleBranchIds(user),
      branchId ? Number(branchId) : undefined,
    );
  }

  @Get('branches')
  @RequirePermissions(APP_PERMISSIONS.HR.STAFF_READ)
  branches(@RequestUser() user: JwtPayload) {
    return this.attendanceService.branchOptions(requireClientId(user), getAccessibleBranchIds(user));
  }

  @Post('mark')
  @RequirePermissions(APP_PERMISSIONS.HR.ATTENDANCE_MARK)
  mark(@RequestUser() user: JwtPayload, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(
      requireClientId(user),
      Number(user.sub),
      getAccessibleBranchIds(user),
      dto,
    );
  }

  @Post('lock')
  @RequirePermissions(APP_PERMISSIONS.HR.ATTENDANCE_MARK)
  lock(@RequestUser() user: JwtPayload, @Body() dto: LockAttendanceDto) {
    return this.attendanceService.lock(
      requireClientId(user),
      Number(user.sub),
      getAccessibleBranchIds(user),
      dto,
    );
  }
}
