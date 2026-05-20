import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttendanceLog } from '../entities/attendance-log.entity';
import { AttendanceLock } from '../entities/attendance-lock.entity';
import { UserManagement } from '../entities/UserManagement.entity';
import { Branch } from '../entities/branch.entity';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { LockAttendanceDto } from './dto/lock-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceLog)
    private readonly attendanceRepo: Repository<AttendanceLog>,
    @InjectRepository(AttendanceLock)
    private readonly attendanceLockRepo: Repository<AttendanceLock>,
    @InjectRepository(UserManagement)
    private readonly userRepo: Repository<UserManagement>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  private enumerateDates(dateFrom: string, dateTo: string) {
    const dates: string[] = [];
    for (const cursor = new Date(dateFrom); cursor <= new Date(dateTo); cursor.setDate(cursor.getDate() + 1)) {
      dates.push(new Date(cursor).toISOString().slice(0, 10));
    }
    return dates;
  }

  async list(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    filters?: {
      branch_id?: number;
      department_id?: number;
      date_from?: string;
      date_to?: string;
      search?: string;
    },
  ) {
    const dateFrom = filters?.date_from || new Date().toISOString().slice(0, 10);
    const dateTo = filters?.date_to || dateFrom;

    const query = this.attendanceRepo
      .createQueryBuilder('log')
      .innerJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('log.branch', 'branch')
      .leftJoinAndSelect('user.department', 'department')
      .leftJoinAndSelect('user.designation', 'designation')
      .where('log.client_id = :clientId', { clientId })
      .andWhere('log.attendance_date BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo });

    if (accessibleBranchIds?.length) {
      query.andWhere('(log.branch_id IS NULL OR log.branch_id IN (:...accessibleBranchIds))', { accessibleBranchIds });
    }

    if (filters?.branch_id) {
      query.andWhere('log.branch_id = :branchId', { branchId: filters.branch_id });
    }

    if (filters?.department_id) {
      query.andWhere('user.department_id = :departmentId', { departmentId: filters.department_id });
    }

    if (filters?.search?.trim()) {
      const search = `%${filters.search.trim().toLowerCase()}%`;
      query.andWhere(`
        (
          LOWER(COALESCE(user.full_name, '')) LIKE :search
          OR LOWER(COALESCE(user.employee_id, '')) LIKE :search
          OR LOWER(COALESCE(user.user_name, '')) LIKE :search
        )
      `, { search });
    }

    query.orderBy('log.attendance_date', 'DESC')
      .addOrderBy('user.full_name', 'ASC');

    const logs = await query.getMany();
    const locksQuery = this.attendanceLockRepo
      .createQueryBuilder('lock')
      .leftJoinAndSelect('lock.branch', 'branch')
      .where('lock.client_id = :clientId', { clientId })
      .andWhere('lock.date_from <= :dateTo', { dateTo })
      .andWhere('lock.date_to >= :dateFrom', { dateFrom });

    if (accessibleBranchIds?.length) {
      locksQuery.andWhere('(lock.branch_id IS NULL OR lock.branch_id IN (:...accessibleBranchIds))', { accessibleBranchIds });
    }
    if (filters?.branch_id) {
      locksQuery.andWhere('(lock.branch_id = :branchId OR lock.branch_id IS NULL)', { branchId: filters.branch_id });
    }

    const locks = await locksQuery
      .orderBy('lock.date_from', 'DESC')
      .addOrderBy('lock.branch_id', 'ASC')
      .getMany();

    const summary = logs.reduce((acc, log) => {
      acc.total += 1;
      acc[log.status] += 1;
      if (log.check_in_at && log.status === 'late') {
        acc.late += 0;
      }
      return acc;
    }, {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      off_duty: 0,
    });

    const requestedDates = this.enumerateDates(dateFrom, dateTo);
    const isLocked = requestedDates.every((attendanceDate) => locks.some((lock) => {
      const branchMatches = filters?.branch_id
        ? lock.branch_id == null || lock.branch_id === filters.branch_id
        : lock.branch_id == null;
      return branchMatches && lock.date_from <= attendanceDate && lock.date_to >= attendanceDate;
    }));

    return {
      rows: logs.map((log) => ({
        id: log.id,
        date: log.attendance_date,
        status: log.status,
        check_in: log.check_in_at,
        check_out: log.check_out_at,
        total_hours: log.working_minutes ? Number(log.working_minutes / 60).toFixed(1) : '0.0',
        comments: log.comments,
        staff: {
          id: log.user.id,
          employee_id: log.user.employee_id,
          full_name: log.user.full_name,
          designation: log.user.designation?.name ?? null,
          department: log.user.department?.name ?? null,
        },
        branch: log.branch ? {
          id: log.branch.id,
          branch_name: log.branch.branch_name,
        } : null,
      })),
      summary,
      locks: locks.map((lock) => ({
        id: lock.id,
        branch_id: lock.branch_id,
        branch_name: lock.branch?.branch_name ?? 'All branches',
        date_from: lock.date_from,
        date_to: lock.date_to,
        locked_by: lock.locked_by,
        reason: lock.reason,
      })),
      is_locked: isLocked,
    };
  }

  private async findBlockingLock(
    clientId: string,
    attendanceDate: string,
    branchId: number | null,
    accessibleBranchIds: number[] | undefined,
  ) {
    const query = this.attendanceLockRepo
      .createQueryBuilder('lock')
      .leftJoinAndSelect('lock.branch', 'branch')
      .where('lock.client_id = :clientId', { clientId })
      .andWhere('lock.date_from <= :attendanceDate', { attendanceDate })
      .andWhere('lock.date_to >= :attendanceDate', { attendanceDate });

    if (branchId) {
      query.andWhere('(lock.branch_id = :branchId OR lock.branch_id IS NULL)', { branchId });
    } else {
      query.andWhere('lock.branch_id IS NULL');
    }

    if (accessibleBranchIds?.length) {
      query.andWhere('(lock.branch_id IS NULL OR lock.branch_id IN (:...accessibleBranchIds))', { accessibleBranchIds });
    }

    return query.orderBy('lock.branch_id', 'DESC').getOne();
  }

  async roster(
    clientId: string,
    accessibleBranchIds: number[] | undefined,
    branchId?: number,
  ) {
    const userQuery = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.branchRoles', 'branchRoles')
      .leftJoinAndSelect('branchRoles.branch', 'branch')
      .leftJoinAndSelect('user.designation', 'designation')
      .where('user.client_id = :clientId', { clientId })
      .andWhere('user.is_active = 1');

    if (branchId) {
      userQuery.andWhere('branchRoles.branch_id = :branchId', { branchId });
    } else if (accessibleBranchIds?.length) {
      userQuery.andWhere('(branchRoles.branch_id IN (:...accessibleBranchIds) OR branchRoles.branch_id IS NULL)', {
        accessibleBranchIds,
      });
    }

    const users = await userQuery.orderBy('user.full_name', 'ASC').getMany();
    return users.map((user) => ({
      id: user.id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      designation: user.designation?.name ?? null,
      employment_type: user.employment_type ?? null,
      branch_id: user.branchRoles?.find((assignment) => assignment.is_primary)?.branch_id
        ?? user.branchRoles?.[0]?.branch_id
        ?? null,
      branch_name: user.branchRoles?.find((assignment) => assignment.is_primary)?.branch?.branch_name
        ?? user.branchRoles?.[0]?.branch?.branch_name
        ?? null,
    }));
  }

  async mark(
    clientId: string,
    markedBy: number,
    accessibleBranchIds: number[] | undefined,
    dto: MarkAttendanceDto,
  ) {
    const entries = dto.entries ?? [];
    if (entries.length === 0) {
      throw new BadRequestException('At least one attendance entry is required.');
    }

    const userIds = [...new Set(entries.map((entry) => Number(entry.user_id)).filter((id) => Number.isInteger(id) && id > 0))];
    const users = await this.userRepo.find({
      where: { client_id: clientId, id: In(userIds), is_active: true },
      relations: ['branchRoles', 'branchRoles.branch'],
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    for (const userId of userIds) {
      const user = userMap.get(userId);
      if (!user) {
        throw new BadRequestException(`User ${userId} does not belong to this tenant.`);
      }

      const primaryBranchId = user.branchRoles?.find((assignment) => assignment.is_primary)?.branch_id
        ?? user.branchRoles?.[0]?.branch_id
        ?? null;

      if (accessibleBranchIds?.length && primaryBranchId && !accessibleBranchIds.includes(primaryBranchId)) {
        throw new BadRequestException(`User ${user.full_name} is outside your branch scope.`);
      }

      const blockingLock = await this.findBlockingLock(clientId, dto.date, primaryBranchId, accessibleBranchIds);
      if (blockingLock) {
        const scopeLabel = blockingLock.branch?.branch_name ?? 'all branches';
        throw new BadRequestException(`Attendance is locked for ${scopeLabel} on ${dto.date}. Changes are blocked.`);
      }
    }

    const existing = await this.attendanceRepo.find({
      where: {
        client_id: clientId,
        attendance_date: dto.date,
        user_id: In(userIds),
      },
    });
    const existingMap = new Map(existing.map((log) => [log.user_id, log]));

    const saved: AttendanceLog[] = [];
    for (const entry of entries) {
      const user = userMap.get(Number(entry.user_id))!;
      const primaryBranchId = user.branchRoles?.find((assignment) => assignment.is_primary)?.branch_id
        ?? user.branchRoles?.[0]?.branch_id
        ?? null;

      const log = existingMap.get(Number(entry.user_id))
        ?? this.attendanceRepo.create({
          client_id: clientId,
          user_id: Number(entry.user_id),
          attendance_date: dto.date,
        });

      log.branch_id = primaryBranchId;
      log.status = entry.status;
      log.comments = entry.comments?.trim() || null;
      log.marked_by = markedBy;
      log.working_minutes = entry.status === 'present' ? 480 : entry.status === 'late' ? 450 : 0;
      log.check_in_at = null;
      log.check_out_at = null;
      saved.push(await this.attendanceRepo.save(log));
    }

    return { saved: saved.length };
  }

  async branchOptions(clientId: string, accessibleBranchIds: number[] | undefined) {
    const where = accessibleBranchIds?.length
      ? { client_id: clientId, id: In(accessibleBranchIds) }
      : { client_id: clientId };
    return this.branchRepo.find({ where, order: { branch_name: 'ASC' } });
  }

  async lock(
    clientId: string,
    lockedBy: number,
    accessibleBranchIds: number[] | undefined,
    dto: LockAttendanceDto,
  ) {
    if (dto.date_from > dto.date_to) {
      throw new BadRequestException('Lock from date cannot be after lock to date.');
    }

    if (dto.branch_id && accessibleBranchIds?.length && !accessibleBranchIds.includes(dto.branch_id)) {
      throw new BadRequestException('Selected branch is outside your branch scope.');
    }

    const lockDates = this.enumerateDates(dto.date_from, dto.date_to);
    const savedIds: number[] = [];

    for (const attendanceDate of lockDates) {
      const duplicate = await this.attendanceLockRepo
        .createQueryBuilder('lock')
        .where('lock.client_id = :clientId', { clientId })
        .andWhere(dto.branch_id ? 'lock.branch_id = :branchId' : 'lock.branch_id IS NULL', { branchId: dto.branch_id })
        .andWhere('lock.date_from = :attendanceDate', { attendanceDate })
        .andWhere('lock.date_to = :attendanceDate', { attendanceDate })
        .getOne();

      if (duplicate) {
        savedIds.push(duplicate.id);
        continue;
      }

      const lock = this.attendanceLockRepo.create({
        client_id: clientId,
        branch_id: dto.branch_id ?? null,
        date_from: attendanceDate,
        date_to: attendanceDate,
        locked_by: lockedBy,
        reason: dto.reason?.trim() || null,
      });
      const saved = await this.attendanceLockRepo.save(lock);
      savedIds.push(saved.id);
    }

    return { locked: true, ids: savedIds, days_locked: savedIds.length };
  }
}
