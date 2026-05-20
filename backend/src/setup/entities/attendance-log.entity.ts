import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from './branch.entity';
import { UserManagement } from './UserManagement.entity';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'off_duty';

@Entity('attendance_logs')
@Index(['client_id', 'attendance_date', 'user_id'], { unique: true })
@Index(['client_id', 'branch_id', 'attendance_date'])
export class AttendanceLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => UserManagement)
  @JoinColumn({ name: 'user_id' })
  user: UserManagement;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({ name: 'attendance_date', type: 'date' })
  attendance_date: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['present', 'absent', 'late', 'leave', 'off_duty'],
    default: 'present',
  })
  status: AttendanceStatus;

  @Column({ name: 'check_in_at', type: 'datetime', nullable: true })
  check_in_at: Date | null;

  @Column({ name: 'check_out_at', type: 'datetime', nullable: true })
  check_out_at: Date | null;

  @Column({ name: 'working_minutes', type: 'int', default: 0 })
  working_minutes: number;

  @Column({ name: 'comments', type: 'varchar', length: 255, nullable: true })
  comments: string | null;

  @Column({ name: 'marked_by', type: 'int', nullable: true })
  marked_by: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

