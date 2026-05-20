import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserManagement } from '../entities/UserManagement.entity';
import { Branch } from '../entities/branch.entity';
import { Role } from '../entities/Roles.entity';
import { Departments } from '../entities/Departments.entity';
import { Designation } from '../entities/Designation.entity';
import { UserBranchRole } from '../entities/user-branch-role.entity';
import { UserBranchPermission } from '../entities/user-branch-permission.entity';
import { AssignBranchesDto } from './dto/assign-branches.dto';
import { CreateUserDto, UpdateMyProfileDto, UpdateMySecurityDto, UpdateUserDto } from './dto/user.dto';
import { EntitlementsService } from '../../platform/entitlements/entitlements.service';
import { ClientSettings } from '../../platform/entities/client-settings.entity';
import { createDefaultClientNumberingSettings } from '../branches/branch-config.types';
import { normalizePermissionKey } from '../../auth/constants/permissions';
import {
  type RoleContextScope,
  type UserApprovalAuthority,
  type UserBranchAssignmentScope,
} from './user-governance.constants';

export interface NormalizedBranchAssignment {
  branchId: number;
  roleId?: number;
  directPermissions: string[];
  isPrimary: boolean;
  assignmentScope?: UserBranchAssignmentScope;
  approvalAuthority?: UserApprovalAuthority;
}

export interface UserAccessBranchInspection {
  branch_id: number;
  branch_name: string | null;
  inventory_store_type: 'branch' | 'central';
  is_primary: boolean;
  role_id: number | null;
  role_name: string | null;
  role_ids?: number[];
  role_names?: string[];
  role_source: 'branch_assignment' | 'global_default' | 'unassigned';
  role_context_scope: RoleContextScope;
  role_approval_authority: UserApprovalAuthority | null;
  assignment_scope: UserBranchAssignmentScope;
  approval_authority: UserApprovalAuthority | null;
  direct_permissions: string[];
  role_permissions: string[];
  effective_permissions: string[];
  writes_require_explicit_context: true;
}

@Injectable()
export class UserManagementsService {
  constructor(
    @InjectRepository(UserManagement)
    private UserManagementRepo: Repository<UserManagement>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Departments)
    private departmentRepo: Repository<Departments>,
    @InjectRepository(Designation)
    private designationRepo: Repository<Designation>,
    @InjectRepository(UserBranchRole)
    private userBranchRoleRepo: Repository<UserBranchRole>,
    @InjectRepository(UserBranchPermission)
    private userBranchPermissionRepo: Repository<UserBranchPermission>,
    private dataSource: DataSource,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  private deriveUserType(
    clientId: string,
    dto: Pick<CreateUserDto, 'user_type' | 'branchAssignments' | 'branch_id'>,
  ): string {
    if (dto.user_type) {
      return dto.user_type;
    }

    if ((dto.branchAssignments?.length ?? 0) > 0 || dto.branch_id) {
      return 'BRANCH_STAFF';
    }

    return clientId.startsWith('NX-') ? 'PLATFORM_ADMIN' : 'CLIENT_ADMIN';
  }

  private async ensureEmailAvailable(email?: string, excludeUserId?: number): Promise<void> {
    if (!email) {
      return;
    }

    const where: FindOptionsWhere<UserManagement> = { email };
    const existing = await this.UserManagementRepo.findOne({ where });
    if (existing && existing.id !== excludeUserId) {
      throw new BadRequestException('Email already registered');
    }
  }

  private async assertRoleBelongsToClient(clientId: string, roleId?: number): Promise<Role | undefined> {
    if (!roleId) {
      return undefined;
    }

    const role = await this.roleRepo.findOne({
      where: { id: roleId, client_id: clientId, is_active: true },
    });

    if (!role) {
      throw new ForbiddenException(`Role ${roleId} does not belong to your organization`);
    }

    return role;
  }

  private async assertDepartmentBelongsToClient(clientId: string, departmentId?: number): Promise<void> {
    if (!departmentId) {
      return;
    }

    const department = await this.departmentRepo.findOne({
      where: { id: departmentId, clientId },
    });

    if (!department) {
      throw new ForbiddenException(`Department ${departmentId} does not belong to your organization`);
    }
  }

  private async assertDesignationBelongsToClient(clientId: string, designationId?: number): Promise<void> {
    if (!designationId) {
      return;
    }

    const designation = await this.designationRepo.findOne({
      where: { id: designationId, clientId },
    });

    if (!designation) {
      throw new ForbiddenException(`Designation ${designationId} does not belong to your organization`);
    }
  }

  private async validateCoreReferences(
    clientId: string,
    dto: Pick<CreateUserDto | UpdateUserDto, 'role_id' | 'department_id' | 'designation_id'>,
  ): Promise<void> {
    await Promise.all([
      this.assertRoleBelongsToClient(clientId, dto.role_id),
      this.assertDepartmentBelongsToClient(clientId, dto.department_id),
      this.assertDesignationBelongsToClient(clientId, dto.designation_id),
    ]);
  }

  private normalizeUserState(
    currentStatus?: string,
    requestedStatus?: string,
    explicitIsActive?: boolean,
  ): { status: 'active' | 'inactive' | 'suspended'; is_active: boolean } {
    let status = (requestedStatus ?? currentStatus ?? 'active') as 'active' | 'inactive' | 'suspended';

    if (explicitIsActive === false && status === 'active') {
      status = 'inactive';
    }

    if (explicitIsActive === true && requestedStatus === undefined) {
      status = 'active';
    }

    return {
      status,
      is_active: explicitIsActive ?? status === 'active',
    };
  }

  private buildRequestedAssignments(
    dto: Pick<CreateUserDto | UpdateUserDto, 'branchAssignments' | 'branch_id' | 'role_id'>,
  ): NormalizedBranchAssignment[] {
    const requestedAssignments =
      dto.branchAssignments !== undefined
        ? (dto.branchAssignments as any[]) // bypass strict pick typing locally
        : dto.branch_id
          ? [
              {
                branchId: Number(dto.branch_id),
                roleId: dto.role_id ? Number(dto.role_id) : undefined,
                roleIds: dto.role_id ? [Number(dto.role_id)] : undefined,
                directPermissions: [],
                isPrimary: true,
                assignmentScope: undefined,
                approvalAuthority: undefined,
              },
            ]
          : [];

    const explicitPrimary = requestedAssignments.filter((assignment) => assignment.isPrimary).length;
    if (explicitPrimary > 1) {
      throw new BadRequestException('Only one primary branch assignment is allowed per user.');
    }

    const expanded: NormalizedBranchAssignment[] = [];
    requestedAssignments.forEach((assignment, index) => {
      const isPrimary = explicitPrimary === 0 ? index === 0 : Boolean(assignment.isPrimary);
      const rawRoles = [
         ...(assignment.roleIds || []),
         assignment.roleId
      ].filter(r => r != null).map(Number).filter(n => !Number.isNaN(n));
      
      const uniqueRoles = [...new Set(rawRoles)];
      
      if (uniqueRoles.length === 0) {
        expanded.push({
          branchId: Number(assignment.branchId),
          roleId: undefined,
          directPermissions: this.normalizePermissionList(assignment.directPermissions ?? []),
          isPrimary,
          assignmentScope: assignment.assignmentScope,
          approvalAuthority: assignment.approvalAuthority,
        });
      } else {
        uniqueRoles.forEach((rId, rIndex) => {
          expanded.push({
            branchId: Number(assignment.branchId),
            roleId: rId != null ? Number(rId) : undefined,
            directPermissions: rIndex === 0 ? this.normalizePermissionList(assignment.directPermissions ?? []) : [],
            isPrimary,
            assignmentScope: assignment.assignmentScope,
            approvalAuthority: assignment.approvalAuthority,
          });
        });
      }
    });

    return expanded;
  }

  private getRoleContextScope(role?: Role | null): RoleContextScope {
    return role?.context_scope ?? 'hybrid';
  }

  private resolveAssignmentScope(
    branch: Branch,
    role: Role | undefined,
    requestedScope?: UserBranchAssignmentScope,
  ): UserBranchAssignmentScope {
    const roleScope = this.getRoleContextScope(role);
    const inferredScope =
      requestedScope
      ?? (roleScope === 'hybrid' ? undefined : roleScope)
      ?? (branch.inventory_store_type === 'central' ? 'central' : 'branch');

    if (role && roleScope === 'branch' && inferredScope !== 'branch') {
      throw new BadRequestException(`Role ${role.role_name} can only be assigned in branch scope.`);
    }

    if (role && roleScope === 'central' && inferredScope !== 'central') {
      throw new BadRequestException(`Role ${role.role_name} can only be assigned in central scope.`);
    }

    if (inferredScope === 'central' && branch.inventory_store_type !== 'central') {
      throw new BadRequestException(
        `Branch ${branch.branch_name} cannot host a central-scope assignment because it is not a central store branch.`,
      );
    }

    return inferredScope;
  }

  private resolveApprovalAuthority(
    assignmentScope: UserBranchAssignmentScope,
    role: Role | undefined,
    requestedAuthority?: UserApprovalAuthority,
  ): UserApprovalAuthority | undefined {
    const resolvedAuthority = requestedAuthority ?? role?.approval_authority ?? undefined;
    if (!resolvedAuthority) {
      return undefined;
    }

    if (assignmentScope === 'branch' && ['central', 'both'].includes(resolvedAuthority)) {
      throw new BadRequestException(
        'Branch-scope assignments can only use branch approval authority or none.',
      );
    }

    if (assignmentScope === 'central' && resolvedAuthority === 'branch') {
      throw new BadRequestException(
        'Central-scope assignments cannot use branch-only approval authority.',
      );
    }

    return resolvedAuthority;
  }

  private async validateBranchAssignments(
    clientId: string,
    userType: string,
    assignments: NormalizedBranchAssignment[],
    accessibleBranchIds?: number[],
  ): Promise<void> {
    this.assertRequestedBranchesAccessible(
      assignments.map((assignment) => assignment.branchId),
      accessibleBranchIds,
    );

    if (userType === 'BRANCH_STAFF' && assignments.length === 0) {
      throw new BadRequestException('Branch staff users require at least one branch assignment.');
    }

    for (const assignment of assignments) {
      if (!Number.isInteger(assignment.branchId) || assignment.branchId <= 0) {
        throw new BadRequestException('Each branch assignment must reference a valid branch.');
      }
    }

    for (const assignment of assignments) {
      const branch = await this.branchRepo.findOne({
        where: { id: assignment.branchId, client_id: clientId },
      });
      if (!branch) {
        throw new ForbiddenException(`Branch ${assignment.branchId} does not belong to your organization`);
      }

      const role = await this.assertRoleBelongsToClient(clientId, assignment.roleId);
      assignment.assignmentScope = this.resolveAssignmentScope(
        branch,
        role,
        assignment.assignmentScope,
      );
      assignment.approvalAuthority = this.resolveApprovalAuthority(
        assignment.assignmentScope,
        role,
        assignment.approvalAuthority,
      );
    }
  }

  private async hasTenantWideAccessibleScope(
    clientId: string,
    accessibleBranchIds?: number[],
  ): Promise<boolean> {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return true;
    }

    const clientBranches = await this.branchRepo.find({
      where: { client_id: clientId },
      select: ['id'],
    });
    const accessible = new Set(accessibleBranchIds.map((branchId) => Number(branchId)));
    return clientBranches.every((branch) => accessible.has(Number(branch.id)));
  }

  private assertRequestedBranchesAccessible(
    requestedBranchIds: number[],
    accessibleBranchIds?: number[],
  ): void {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return;
    }

    for (const branchId of requestedBranchIds) {
      if (!accessibleBranchIds.includes(branchId)) {
        throw new ForbiddenException(`Branch ${branchId} is outside your allowed scope`);
      }
    }
  }

  private filterUserByAccessibleBranches(
    user: UserManagement,
    accessibleBranchIds?: number[],
    actorHasTenantWideScope = false,
  ): UserManagement {
    if (!accessibleBranchIds || accessibleBranchIds.length === 0) {
      return user;
    }

    const scopedRoles = user.branchRoles?.filter((ubr) => accessibleBranchIds.includes(ubr.branch_id)) ?? [];
    const scopedPermissions =
      user.branchPermissions?.filter((ubp) => accessibleBranchIds.includes(ubp.branch_id)) ?? [];

    const hasScopedAccess =
      scopedRoles.length > 0 ||
      scopedPermissions.length > 0 ||
      (
        actorHasTenantWideScope &&
        user.user_type === 'CLIENT_ADMIN' &&
        (user.branchRoles?.length ?? 0) === 0 &&
        (user.branchPermissions?.length ?? 0) === 0
      );

    if (!hasScopedAccess) {
      throw new NotFoundException('User not found');
    }

    user.branchRoles = scopedRoles;
    user.branchPermissions = scopedPermissions;
    return user;
  }

  private parseRolePermissions(role?: Role | null): string[] {
    if (!role?.permissions) {
      return [];
    }

    return this.normalizePermissionList(
      Array.isArray(role.permissions)
        ? role.permissions
        : JSON.parse(role.permissions as unknown as string),
    );
  }

  private normalizePermissionList(permissions: unknown[]): string[] {
    return [...new Set(
      permissions
        .map((permission) => normalizePermissionKey(typeof permission === 'string' ? permission : String(permission ?? '')))
        .filter(Boolean),
    )];
  }

  private buildBranchAccessInspection(
    user: UserManagement,
    branch: Branch,
    isPrimary: boolean,
  ): UserAccessBranchInspection {
    const branchId = Number(branch.id);
    const branchRoles = user.branchRoles?.filter((assignment) => assignment.branch_id === branchId) ?? [];
    const primaryBranchRole = branchRoles.find((assignment) => assignment.is_primary) ?? branchRoles[0];
    const roleEntity = primaryBranchRole?.roleEntity ?? user.roleEntity ?? null;
    const rolePermissions = [
      ...new Set(
        branchRoles.flatMap((assignment) => this.parseRolePermissions(assignment.roleEntity ?? null)),
      ),
    ];
    const directPermissions =
      user.branchPermissions
        ?.filter((permission) => permission.branch_id === branchId)
        .map((permission) => normalizePermissionKey(permission.permission_id)) ?? [];
    const roleIds = [...new Set(branchRoles.map((assignment) => Number(assignment.role_id)).filter((value) => Number.isInteger(value) && value > 0))];
    const roleNames = [
      ...new Set(
        branchRoles
          .map((assignment) => assignment.roleEntity?.role_name ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    return {
      branch_id: branchId,
      branch_name: branch.branch_name ?? null,
      inventory_store_type: branch.inventory_store_type,
      is_primary: isPrimary,
      role_id: primaryBranchRole?.role_id ?? user.role_id ?? null,
      role_name: primaryBranchRole?.roleEntity?.role_name ?? user.roleEntity?.role_name ?? null,
      role_ids: roleIds,
      role_names: roleNames,
      role_source: primaryBranchRole?.role_id
        ? 'branch_assignment'
        : user.role_id
          ? 'global_default'
          : 'unassigned',
      role_context_scope: this.getRoleContextScope(roleEntity),
      role_approval_authority: roleEntity?.approval_authority ?? null,
      assignment_scope:
        primaryBranchRole?.assignment_scope
        ?? (branch.inventory_store_type === 'central' ? 'central' : 'branch'),
      approval_authority: primaryBranchRole?.approval_authority ?? roleEntity?.approval_authority ?? null,
      direct_permissions: [...new Set(directPermissions)].sort(),
      role_permissions: [...new Set(rolePermissions)].sort(),
      effective_permissions: [...new Set([...rolePermissions, ...directPermissions])].sort(),
      writes_require_explicit_context: true,
    };
  }

  private sanitizeUser(user: UserManagement) {
    const {
      password_hash,
      management_pin,
      pos_approval_pin,
      pos_user_pin,
      ...safeUser
    } = user as UserManagement & {
      password_hash?: string;
      management_pin?: string | null;
      pos_approval_pin?: string | null;
      pos_user_pin?: string | null;
    };

    return safeUser;
  }

  private buildMyProfileResponse(user: UserManagement) {
    const safeUser = this.sanitizeUser(user);
    const primaryBranch = user.branchRoles?.find((assignment) => assignment.is_primary) ?? user.branchRoles?.[0] ?? null;
    const effectivePermissions = [
      ...new Set(
        (user.branchRoles ?? []).flatMap((assignment) => this.parseRolePermissions(assignment.roleEntity))
          .concat((user.branchPermissions ?? []).map((permission) => normalizePermissionKey(permission.permission_id))),
      ),
    ].sort();

    return {
      ...safeUser,
      pos_approval_pin: user.pos_approval_pin || '',
      management_pin: user.management_pin || '',
      pos_user_pin: user.pos_user_pin || '',
      primary_role_name: primaryBranch?.roleEntity?.role_name || user.roleEntity?.role_name || null,
      primary_branch_name: primaryBranch?.branch?.branch_name || null,
      effective_permissions: effectivePermissions,
    };
  }

  async create(
    clientId: string,
    dto: CreateUserDto,
    accessibleBranchIds?: number[],
  ): Promise<UserManagement> {
    await this.validateCoreReferences(clientId, dto);
    await this.ensureEmailAvailable(dto.email);
    const derivedUserType = this.deriveUserType(clientId, dto as CreateUserDto);
    const normalizedAssignments = this.buildRequestedAssignments(dto);
    await this.validateBranchAssignments(
      clientId,
      derivedUserType,
      normalizedAssignments,
      accessibleBranchIds,
    );
    const userState = this.normalizeUserState(undefined, dto.status);
    if (userState.is_active && userState.status === 'active') {
      await this.entitlementsService.assertCanCreateActiveUser(clientId);
    }

    const count = await this.UserManagementRepo.count({ where: { client_id: clientId } });
    const sequence = count + 1;
    const clientSettings = await this.dataSource.getRepository(ClientSettings).findOne({
      where: { client_id: clientId },
    });
    const numberingDefaults = createDefaultClientNumberingSettings();
    const employeePrefix = clientSettings?.numbering_settings?.employee_code_prefix || numberingDefaults.employee_code_prefix;
    const employeePad = clientSettings?.numbering_settings?.employee_code_zero_pad || numberingDefaults.employee_code_zero_pad;
    const employeeId = dto.employee_id || `${employeePrefix}-${clientId}-${String(sequence).padStart(employeePad, '0')}`;

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);

    const user = this.UserManagementRepo.create({
      client_id: clientId,
      full_name: dto.full_name,
      user_name: dto.user_name || dto.full_name,
      email: dto.email,
      password_hash: hash,
      employee_id: employeeId,
      role_id: dto.role_id,
      department_id: dto.department_id,
      designation_id: dto.designation_id,
      management_pin: dto.management_pin,
      pos_approval_pin: dto.pos_approval_pin,
      pos_user_pin: dto.pos_user_pin,
      user_type: derivedUserType,
      phone: dto.phone,
      alternate_phone: dto.alternate_phone,
      emergency_contact_name: dto.emergency_contact_name,
      emergency_contact_relationship: dto.emergency_contact_relationship,
      emergency_contact_phone: dto.emergency_contact_phone,
      cnic_number: dto.cnic_number,
      address: dto.address,
      father_husband_name: dto.father_husband_name,
      gender: dto.gender,
      religion: dto.religion,
      sect: dto.sect,
      date_of_birth: dto.date_of_birth,
      locality: dto.locality,
      city: dto.city,
      country: dto.country,
      joining_date: dto.joining_date,
      employment_type: dto.employment_type,
      leaving_date: dto.leaving_date,
      current_salary: dto.current_salary,
      salary_type: dto.salary_type,
      salary_revision_date: dto.salary_revision_date,
      hr_remarks: dto.hr_remarks,
      vehicle_type: dto.vehicle_type,
      vehicle_reg_no: dto.vehicle_reg_no,
      vehicle_make_model: dto.vehicle_make_model,
      vehicle_color: dto.vehicle_color,
      bank_name: dto.bank_name,
      account_title: dto.account_title,
      account_number: dto.account_number,
      force_password_change: dto.force_password_change ?? false,
      attachments: dto.attachments ?? null,
      status: userState.status,
      is_active: userState.is_active,
      profile_picture: dto.profile_picture,
    });

    const savedUser = await this.UserManagementRepo.save(user);
    const userIdNum = Number(savedUser.id);

    if (dto.branchAssignments !== undefined) {
      await this.assignBranches(
        clientId,
        userIdNum,
        { branchAssignments: dto.branchAssignments },
        accessibleBranchIds,
        true,
      );
    } else if (dto.branch_id) {
      await this.assignBranches(clientId, userIdNum, {
        branchAssignments: [
          {
            branchId: Number(dto.branch_id),
            roleId: dto.role_id ? Number(dto.role_id) : undefined,
            directPermissions: [],
            isPrimary: true,
            assignmentScope: undefined,
            approvalAuthority: undefined,
          },
        ],
      }, accessibleBranchIds, true);
    }

    return this.findOne(clientId, userIdNum, accessibleBranchIds);
  }

  async findAll(clientId: string, accessibleBranchIds?: number[]): Promise<UserManagement[]> {
    const actorHasTenantWideScope = await this.hasTenantWideAccessibleScope(clientId, accessibleBranchIds);
    const users = await this.UserManagementRepo.find({
      where: { client_id: clientId },
      relations: [
        'roleEntity',
        'department',
        'designation',
        'branchRoles',
        'branchRoles.branch',
        'branchRoles.roleEntity',
        'branchPermissions',
        'branchPermissions.branch',
      ],
    });
    const scopedUsers: UserManagement[] = [];
    for (const user of users) {
      try {
        scopedUsers.push(this.filterUserByAccessibleBranches(user, accessibleBranchIds, actorHasTenantWideScope));
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    return scopedUsers;
  }

  async findOne(clientId: string, id: number, accessibleBranchIds?: number[]): Promise<UserManagement> {
    const actorHasTenantWideScope = await this.hasTenantWideAccessibleScope(clientId, accessibleBranchIds);
    const user = await this.UserManagementRepo.findOne({
      where: { client_id: clientId, id },
      relations: [
        'roleEntity',
        'department',
        'designation',
        'branchRoles',
        'branchRoles.branch',
        'branchRoles.roleEntity',
        'branchPermissions',
        'branchPermissions.branch',
      ],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.filterUserByAccessibleBranches(user, accessibleBranchIds, actorHasTenantWideScope);
  }

  async findMyProfile(
    clientId: string,
    userId: number,
    accessibleBranchIds?: number[],
  ) {
    const user = await this.findOne(clientId, userId, accessibleBranchIds);
    return this.buildMyProfileResponse(user);
  }

  async updateMyProfile(
    clientId: string,
    userId: number,
    dto: UpdateMyProfileDto,
    accessibleBranchIds?: number[],
  ) {
    const user = await this.findOne(clientId, userId, accessibleBranchIds);

    if (dto.email && dto.email !== user.email) {
      await this.ensureEmailAvailable(dto.email, userId);
    }

    if (dto.full_name !== undefined) user.full_name = dto.full_name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.alternate_phone !== undefined) user.alternate_phone = dto.alternate_phone;
    if (dto.emergency_contact_name !== undefined) user.emergency_contact_name = dto.emergency_contact_name;
    if (dto.emergency_contact_relationship !== undefined) user.emergency_contact_relationship = dto.emergency_contact_relationship;
    if (dto.emergency_contact_phone !== undefined) user.emergency_contact_phone = dto.emergency_contact_phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.locality !== undefined) user.locality = dto.locality;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.country !== undefined) user.country = dto.country;
    if (dto.profile_picture !== undefined) user.profile_picture = dto.profile_picture;

    const saved = await this.UserManagementRepo.save(user);
    return this.buildMyProfileResponse(saved);
  }

  async updateMySecurity(
    clientId: string,
    userId: number,
    dto: UpdateMySecurityDto,
    accessibleBranchIds?: number[],
  ) {
    const user = await this.findOne(clientId, userId, accessibleBranchIds);

    if (!user.password_hash || !(await bcrypt.compare(dto.current_password, user.password_hash))) {
      throw new ForbiddenException('Current password is incorrect.');
    }

    if (!dto.new_password && dto.pos_approval_pin === undefined && dto.management_pin === undefined && dto.pos_user_pin === undefined) {
      throw new BadRequestException('No security changes were submitted.');
    }

    if (dto.new_password) {
      const salt = await bcrypt.genSalt();
      user.password_hash = await bcrypt.hash(dto.new_password, salt);
      user.force_password_change = false;
    }

    if (dto.pos_approval_pin !== undefined) {
      user.pos_approval_pin = dto.pos_approval_pin;
    }

    if (dto.management_pin !== undefined) {
      user.management_pin = dto.management_pin;
    }

    if (dto.pos_user_pin !== undefined) {
      user.pos_user_pin = dto.pos_user_pin;
    }

    const saved = await this.UserManagementRepo.save(user);
    return this.buildMyProfileResponse(saved);
  }

  async update(
    clientId: string,
    id: number,
    dto: UpdateUserDto,
    accessibleBranchIds?: number[],
  ): Promise<UserManagement> {
    const user = await this.findOne(clientId, id, accessibleBranchIds);

    await this.validateCoreReferences(clientId, dto);
    if (dto.email && dto.email !== user.email) {
      await this.ensureEmailAvailable(dto.email, id);
    }

    if (dto.password) {
      const salt = await bcrypt.genSalt();
      user.password_hash = await bcrypt.hash(dto.password, salt);
    }

    if (dto.full_name !== undefined) user.full_name = dto.full_name;
    if (dto.employee_id !== undefined) user.employee_id = dto.employee_id;
    if (dto.user_name !== undefined) user.user_name = dto.user_name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.role_id !== undefined) user.role_id = dto.role_id;
    if (dto.department_id !== undefined) user.department_id = dto.department_id;
    if (dto.designation_id !== undefined) user.designation_id = dto.designation_id;
    if (dto.management_pin !== undefined) user.management_pin = dto.management_pin;
    if (dto.pos_approval_pin !== undefined) user.pos_approval_pin = dto.pos_approval_pin;
    if (dto.pos_user_pin !== undefined) user.pos_user_pin = dto.pos_user_pin;
    if (dto.user_type !== undefined) user.user_type = dto.user_type;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.alternate_phone !== undefined) user.alternate_phone = dto.alternate_phone;
    if (dto.emergency_contact_name !== undefined) user.emergency_contact_name = dto.emergency_contact_name;
    if (dto.emergency_contact_relationship !== undefined) user.emergency_contact_relationship = dto.emergency_contact_relationship;
    if (dto.emergency_contact_phone !== undefined) user.emergency_contact_phone = dto.emergency_contact_phone;
    if (dto.cnic_number !== undefined) user.cnic_number = dto.cnic_number;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.father_husband_name !== undefined) user.father_husband_name = dto.father_husband_name;
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.religion !== undefined) user.religion = dto.religion;
    if (dto.sect !== undefined) user.sect = dto.sect;
    if (dto.date_of_birth !== undefined) user.date_of_birth = dto.date_of_birth;
    if (dto.locality !== undefined) user.locality = dto.locality;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.country !== undefined) user.country = dto.country;
    if (dto.joining_date !== undefined) user.joining_date = dto.joining_date;
    if (dto.employment_type !== undefined) user.employment_type = dto.employment_type;
    if (dto.leaving_date !== undefined) user.leaving_date = dto.leaving_date;
    if (dto.current_salary !== undefined) user.current_salary = dto.current_salary;
    if (dto.salary_type !== undefined) user.salary_type = dto.salary_type;
    if (dto.salary_revision_date !== undefined) user.salary_revision_date = dto.salary_revision_date;
    if (dto.hr_remarks !== undefined) user.hr_remarks = dto.hr_remarks;
    if (dto.vehicle_type !== undefined) user.vehicle_type = dto.vehicle_type;
    if (dto.vehicle_reg_no !== undefined) user.vehicle_reg_no = dto.vehicle_reg_no;
    if (dto.vehicle_make_model !== undefined) user.vehicle_make_model = dto.vehicle_make_model;
    if (dto.vehicle_color !== undefined) user.vehicle_color = dto.vehicle_color;
    if (dto.bank_name !== undefined) user.bank_name = dto.bank_name;
    if (dto.account_title !== undefined) user.account_title = dto.account_title;
    if (dto.account_number !== undefined) user.account_number = dto.account_number;
    if (dto.force_password_change !== undefined) user.force_password_change = dto.force_password_change;
    if (dto.attachments !== undefined) user.attachments = dto.attachments;
    if (dto.profile_picture !== undefined) user.profile_picture = dto.profile_picture;

    const normalizedAssignments = this.buildRequestedAssignments(dto);
    const assignmentUpdateRequested =
      dto.branchAssignments !== undefined ||
      dto.branch_id !== undefined ||
      dto.user_type === 'BRANCH_STAFF';
    if (assignmentUpdateRequested) {
      const assignmentsToValidate =
        dto.branchAssignments !== undefined || dto.branch_id !== undefined
          ? normalizedAssignments
          : (user.branchRoles ?? []).map((assignment, index) => ({
              branchId: assignment.branch_id,
              roleId: assignment.role_id ?? undefined,
              directPermissions:
                user.branchPermissions
                  ?.filter((permission) => permission.branch_id === assignment.branch_id)
                  .map((permission) => normalizePermissionKey(permission.permission_id)) ?? [],
              isPrimary: assignment.is_primary || index === 0,
              assignmentScope: assignment.assignment_scope ?? undefined,
              approvalAuthority: assignment.approval_authority ?? undefined,
            }));

      await this.validateBranchAssignments(
        clientId,
        dto.user_type ?? user.user_type,
        assignmentsToValidate,
        accessibleBranchIds,
      );
    }
    const userState = this.normalizeUserState(user.status, dto.status, dto.is_active);
    if (
      userState.is_active &&
      userState.status === 'active' &&
      !(user.is_active && user.status === 'active')
    ) {
      await this.entitlementsService.assertCanActivateUser(clientId, id);
    }
    user.status = userState.status;
    user.is_active = userState.is_active;

    const savedUser = await this.UserManagementRepo.save(user);

    if (dto.branchAssignments !== undefined) {
      await this.assignBranches(clientId, id, { branchAssignments: dto.branchAssignments }, accessibleBranchIds);
    } else if (dto.branch_id) {
      await this.assignBranches(clientId, id, {
        branchAssignments: [
          {
            branchId: Number(dto.branch_id),
            roleId: dto.role_id ?? user.role_id ?? undefined,
            directPermissions: [],
            isPrimary: true,
            assignmentScope: undefined,
            approvalAuthority: undefined,
          },
        ],
      }, accessibleBranchIds);
    }

    return this.findOne(clientId, Number(savedUser.id), accessibleBranchIds);
  }

  async assignBranches(
    clientId: string,
    userId: number,
    dto: AssignBranchesDto,
    accessibleBranchIds?: number[],
    isNewUser = false,
  ): Promise<void> {
    const user = await this.findOne(clientId, userId, isNewUser ? undefined : accessibleBranchIds);
    const normalizedAssignments = this.buildRequestedAssignments({
      branchAssignments: dto.branchAssignments,
      branch_id: undefined,
      role_id: undefined,
    });
    await this.validateBranchAssignments(
      clientId,
      user.user_type,
      normalizedAssignments,
      accessibleBranchIds,
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserBranchRole, { user_id: userId });
      await manager.delete(UserBranchPermission, { user_id: userId });

      for (const assignment of normalizedAssignments) {
        const ubr = manager.create(UserBranchRole, {
          user_id: userId,
          branch_id: assignment.branchId,
          role_id: assignment.roleId ?? undefined,
          assignment_scope: assignment.assignmentScope ?? null,
          approval_authority: assignment.approvalAuthority ?? null,
          is_primary: assignment.isPrimary,
        });
        await manager.save(ubr);

        for (const permId of assignment.directPermissions) {
          const ubp = manager.create(UserBranchPermission, {
            user_id: userId,
            branch_id: assignment.branchId,
            permission_id: normalizePermissionKey(permId),
          });
          await manager.save(ubp);
        }
      }
    });
  }

  async inspectAccess(
    clientId: string,
    userId: number,
    accessibleBranchIds?: number[],
  ): Promise<{
    user_id: number;
    client_id: string | null;
    user_type: string;
    status: string;
    is_active: boolean;
    branch_context_required: true;
    summary: {
      total_accessible_branches: number;
      primary_branch_id: number | null;
      tenant_wide_access: boolean;
      central_assignment_count: number;
      branch_assignment_count: number;
      branch_approval_assignment_count: number;
      central_approval_assignment_count: number;
    };
    branches: UserAccessBranchInspection[];
  }> {
    const actorHasTenantWideScope = await this.hasTenantWideAccessibleScope(clientId, accessibleBranchIds);
    const user = await this.findOne(clientId, userId, accessibleBranchIds);
    const clientBranches = await this.branchRepo.find({
      where: { client_id: clientId },
      order: { branch_name: 'ASC' },
    });

    const assignmentMap = new Map(
      (user.branchRoles ?? []).map((assignment) => [assignment.branch_id, assignment]),
    );
    const tenantWideAccess =
      user.user_type === 'CLIENT_ADMIN' && (user.branchRoles?.length ?? 0) === 0;

    const visibleBranchList = tenantWideAccess
      ? clientBranches.filter((branch) =>
          !accessibleBranchIds?.length || accessibleBranchIds.includes(Number(branch.id)),
        )
      : (user.branchRoles ?? [])
          .filter((assignment) =>
            !accessibleBranchIds?.length || accessibleBranchIds.includes(Number(assignment.branch_id)),
          )
          .map((assignment) => assignment.branch)
          .filter((branch): branch is Branch => Boolean(branch));

    const visibleBranches = Array.from(
      new Map(visibleBranchList.map((branch) => [Number(branch.id), branch])).values(),
    );

    if (!tenantWideAccess && visibleBranches.length === 0 && !actorHasTenantWideScope) {
      throw new NotFoundException('User not found');
    }

    const primaryBranchId =
      user.branchRoles?.find((assignment) => assignment.is_primary)?.branch_id ??
      visibleBranches[0]?.id ??
      null;

    const branches = visibleBranches.map((branch) =>
      this.buildBranchAccessInspection(
        user,
        branch,
        Number(branch.id) === Number(primaryBranchId),
      ),
    );

    return {
      user_id: user.id,
      client_id: user.client_id ?? null,
      user_type: user.user_type,
      status: user.status,
      is_active: user.is_active,
      branch_context_required: true,
      summary: {
        total_accessible_branches: branches.length,
        primary_branch_id: primaryBranchId ? Number(primaryBranchId) : null,
        tenant_wide_access: tenantWideAccess,
        central_assignment_count: branches.filter((branch) => branch.assignment_scope === 'central').length,
        branch_assignment_count: branches.filter((branch) => branch.assignment_scope === 'branch').length,
        branch_approval_assignment_count: branches.filter((branch) =>
          ['branch', 'both'].includes(branch.approval_authority ?? 'none'),
        ).length,
        central_approval_assignment_count: branches.filter((branch) =>
          ['central', 'both'].includes(branch.approval_authority ?? 'none'),
        ).length,
      },
      branches,
    };
  }

  async duplicate(
    clientId: string,
    sourceUserId: number,
    targetUserId: number,
    accessibleBranchIds?: number[],
  ): Promise<void> {
    const sourceUser = await this.findOne(clientId, sourceUserId, accessibleBranchIds);
    await this.findOne(clientId, targetUserId, accessibleBranchIds);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserBranchRole, { user_id: targetUserId });
      await manager.delete(UserBranchPermission, { user_id: targetUserId });

      for (const ubr of sourceUser.branchRoles) {
        const copy = manager.create(UserBranchRole, {
          user_id: targetUserId,
          branch_id: ubr.branch_id,
          role_id: ubr.role_id,
          assignment_scope: ubr.assignment_scope ?? null,
          approval_authority: ubr.approval_authority ?? null,
          is_primary: ubr.is_primary,
        });
        await manager.save(copy);
      }

      for (const ubp of sourceUser.branchPermissions) {
        const copy = manager.create(UserBranchPermission, {
          user_id: targetUserId,
          branch_id: ubp.branch_id,
          permission_id: normalizePermissionKey(ubp.permission_id),
        });
        await manager.save(copy);
      }
    });
  }

  async remove(clientId: string, id: number, accessibleBranchIds?: number[]): Promise<void> {
    const user = await this.findOne(clientId, id, accessibleBranchIds);
    await this.UserManagementRepo.remove(user);
  }

  async findByEmail(email: string): Promise<UserManagement | null> {
    return this.UserManagementRepo.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<UserManagement | null> {
    return this.UserManagementRepo.findOne({ where: { user_name: username } });
  }
}
