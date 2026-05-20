import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';
import { Shift } from './shift.entity';

export type BusinessDayStatus = 'open' | 'closed' | 'off_day' | 'cancelled';

@Entity('business_days')
@Index(['client_id', 'branch_id', 'business_date'], { unique: true })
@Index(['client_id', 'branch_id', 'status'])
export class BusinessDay {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id', type: 'int' })
  branch_id: number;

  @Column({ name: 'title', type: 'varchar', length: 120 })
  title: string;

  @Column({ name: 'business_date', type: 'date' })
  business_date: string;

  @Column({ name: 'opened_at', type: 'datetime', nullable: true })
  opened_at: Date | null;

  @Column({ name: 'planned_closing_at', type: 'datetime', nullable: true })
  planned_closing_at: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closed_at: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['open', 'closed', 'off_day', 'cancelled'],
    default: 'open',
  })
  status: BusinessDayStatus;

  @Column({ name: 'is_off_day', type: 'boolean', default: false })
  is_off_day: boolean;

  @Column({ name: 'off_day_reason', type: 'text', nullable: true })
  off_day_reason: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'opened_by_user_id', type: 'int', nullable: true })
  opened_by_user_id: number | null;

  @Column({ name: 'closed_by_user_id', type: 'int', nullable: true })
  closed_by_user_id: number | null;

  @OneToMany(() => Shift, (shift) => shift.business_day)
  shifts: Shift[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

