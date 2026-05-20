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
import { Branch } from '../../setup/entities/branch.entity';
import { Client } from '../../platform/entities/client.entity';
import { PeriodLockMode } from '../dto/accounting-write.dto';

@Entity('accounting_period_locks')
@Index(['client_id', 'branch_id'])
export class AccountingPeriodLock {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({
    type: 'enum',
    enum: PeriodLockMode,
    default: PeriodLockMode.NONE,
  })
  mode: PeriodLockMode;

  @Column({ name: 'locked_through_date', type: 'date', nullable: true })
  locked_through_date: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 100, nullable: true })
  updated_by: string | null;

  @Column({ name: 'last_reopened_by', type: 'varchar', length: 100, nullable: true })
  last_reopened_by: string | null;

  @Column({ name: 'last_reopened_at', type: 'datetime', nullable: true })
  last_reopened_at: Date | null;

  @Column({ name: 'last_reopen_reason', type: 'varchar', length: 500, nullable: true })
  last_reopen_reason: string | null;

  @Column({ name: 'year_end_finalized_period_key', type: 'varchar', length: 7, nullable: true })
  year_end_finalized_period_key: string | null;

  @Column({ name: 'year_end_finalized_by', type: 'varchar', length: 100, nullable: true })
  year_end_finalized_by: string | null;

  @Column({ name: 'year_end_finalized_at', type: 'datetime', nullable: true })
  year_end_finalized_at: Date | null;

  @Column({ name: 'year_end_close_journal_entry_id', type: 'int', nullable: true })
  year_end_close_journal_entry_id: number | null;

  @Column({ name: 'year_end_reopened_by', type: 'varchar', length: 100, nullable: true })
  year_end_reopened_by: string | null;

  @Column({ name: 'year_end_reopened_at', type: 'datetime', nullable: true })
  year_end_reopened_at: Date | null;

  @Column({ name: 'year_end_reopen_reason', type: 'varchar', length: 500, nullable: true })
  year_end_reopen_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
