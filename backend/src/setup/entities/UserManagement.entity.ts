import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from './branch.entity';
import { Role } from './Roles.entity';
import { Departments } from './Departments.entity';
import { Designation } from './Designation.entity';
import { UserBranchRole } from './user-branch-role.entity';
import { UserBranchPermission } from './user-branch-permission.entity';
import { UserRole } from './user-role.entity';

@Entity('users')
@Index(['client_id', 'employee_id'])
/* 
  Business Rule: LoginID (user_name) must be unique within each client organization 
  to prevent ambiguity during authentication while allowing different clients to 
  use the same common usernames.
*/
@Index(['client_id', 'user_name'], { unique: true })
export class UserManagement {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20, nullable: true })
  client_id: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  roleEntity: Role;

  @Column({ name: 'role_id', nullable: true })
  role_id: number;

  @OneToMany(() => UserBranchRole, (ubr) => ubr.user)
  branchRoles: UserBranchRole[];

  @OneToMany(() => UserBranchPermission, (ubp) => ubp.user)
  branchPermissions: UserBranchPermission[];

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @ManyToOne(() => Departments, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Departments;

  @Column({ name: 'department_id', nullable: true })
  department_id: number;

  @ManyToOne(() => Designation, { nullable: true })
  @JoinColumn({ name: 'designation_id' })
  designation: Designation;

  @Column({ name: 'designation_id', nullable: true })
  designation_id: number;

  @Column({ name: 'group_id', type: 'char', length: 36, nullable: true })
  group_id: string;

  @Column({ length: 50, nullable: true })
  employee_id: string;

  @Column({ name: 'full_name', length: 150, nullable: true })
  full_name: string;


  @Column({ name: 'first_name', length: 75, nullable: true })
  first_name: string;

  @Column({ name: 'last_name', length: 75, nullable: true })
  last_name: string;

  @Column({ name: 'user_name', length: 150 })
  user_name: string;

  @Column({ name: 'email', length: 150, nullable: true })
  /* Note: Email is not unique, multiple users can share the same contact email */
  email: string;

  @Column({ name: 'user_password_hash', length: 255 })
  password_hash: string;

  @Column({ name: 'management_pin', type: 'varchar', length: 10, nullable: true })
  management_pin: string | null;

  @Column({ name: 'pos_approval_pin', type: 'varchar', length: 10, nullable: true })
  pos_approval_pin: string | null;

  @Column({ name: 'pos_user_pin', type: 'varchar', length: 10, nullable: true })
  pos_user_pin: string | null;

  @Column({ name: 'user_type', type: 'enum', enum: ['PLATFORM_ADMIN', 'CLIENT_ADMIN', 'BRANCH_STAFF'], default: 'BRANCH_STAFF' })
  user_type: string;

  @Column({ name: 'status', type: 'enum', enum: ['active', 'inactive', 'suspended'], default: 'active' })
  status: string;

  @Column({ name: 'is_locked', default: false })
  is_locked: boolean;

  @Column({ name: 'wrong_attempts_limit', default: 5 })
  wrong_attempts_limit: number;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date | null;

  @Column({ name: 'last_login_ip', type: 'varchar', length: 64, nullable: true })
  last_login_ip: string | null;

  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profile_picture: string;

  @Column({ name: 'phone', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'alternate_phone', type: 'varchar', length: 20, nullable: true })
  alternate_phone: string | null;

  @Column({ name: 'emergency_contact_name', type: 'varchar', length: 150, nullable: true })
  emergency_contact_name: string | null;

  @Column({ name: 'emergency_contact_relationship', type: 'varchar', length: 100, nullable: true })
  emergency_contact_relationship: string | null;

  @Column({ name: 'emergency_contact_phone', type: 'varchar', length: 20, nullable: true })
  emergency_contact_phone: string | null;

  @Column({ name: 'cnic_number', length: 20, nullable: true })
  cnic_number: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'father_husband_name', type: 'varchar', length: 150, nullable: true })
  father_husband_name: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 20, nullable: true })
  gender: string | null;

  @Column({ name: 'religion', type: 'varchar', length: 50, nullable: true })
  religion: string | null;

  @Column({ name: 'sect', type: 'varchar', length: 50, nullable: true })
  sect: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  date_of_birth: string | null;

  @Column({ name: 'locality', type: 'varchar', length: 120, nullable: true })
  locality: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'joining_date', type: 'date', nullable: true })
  joining_date: string | null;

  @Column({ name: 'employment_type', type: 'varchar', length: 50, nullable: true })
  employment_type: string | null;

  @Column({ name: 'leaving_date', type: 'date', nullable: true })
  leaving_date: string | null;

  @Column({ name: 'current_salary', type: 'decimal', precision: 12, scale: 2, nullable: true })
  current_salary: string | null;

  @Column({ name: 'salary_type', type: 'varchar', length: 50, nullable: true })
  salary_type: string | null;

  @Column({ name: 'salary_revision_date', type: 'date', nullable: true })
  salary_revision_date: string | null;

  @Column({ name: 'hr_remarks', type: 'text', nullable: true })
  hr_remarks: string | null;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 50, nullable: true })
  vehicle_type: string | null;

  @Column({ name: 'vehicle_reg_no', type: 'varchar', length: 50, nullable: true })
  vehicle_reg_no: string | null;

  @Column({ name: 'vehicle_make_model', type: 'varchar', length: 150, nullable: true })
  vehicle_make_model: string | null;

  @Column({ name: 'vehicle_color', type: 'varchar', length: 50, nullable: true })
  vehicle_color: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 120, nullable: true })
  bank_name: string | null;

  @Column({ name: 'account_title', type: 'varchar', length: 150, nullable: true })
  account_title: string | null;

  @Column({ name: 'account_number', type: 'varchar', length: 100, nullable: true })
  account_number: string | null;

  @Column({ name: 'force_password_change', default: false })
  force_password_change: boolean;

  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: Array<{ id: string; title: string; file: string; fileName: string }> | null;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

