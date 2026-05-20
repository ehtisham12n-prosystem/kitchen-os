import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('approvals')
@Index(['module', 'entity_id'])
@Index(['status', 'branch_id'])
export class Approval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'module', type: 'varchar', length: 60 })
  module: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 100 })
  entity_id: string;

  @Column({ name: 'action_type', type: 'varchar', length: 80 })
  action_type: string;

  @Column({ name: 'requested_by', type: 'varchar', length: 50 })
  requested_by: string;

  @Column({ name: 'approved_by', type: 'varchar', length: 50, nullable: true })
  approved_by: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branch_id: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decision_notes: string | null;

  @Column({ name: 'requested_at', type: 'datetime', nullable: true })
  requested_at: Date | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
