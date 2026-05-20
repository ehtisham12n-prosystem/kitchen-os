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

@Entity('shift_templates')
@Index(['client_id', 'branch_id', 'is_active'])
@Index(['client_id', 'branch_id', 'code'])
export class ShiftTemplate {
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

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'planned_start_time', type: 'time' })
  planned_start_time: string;

  @Column({ name: 'planned_end_time', type: 'time' })
  planned_end_time: string;

  @Column({ name: 'sort_order', type: 'int', default: 1 })
  sort_order: number;

  @Column({ name: 'allow_overlap', type: 'boolean', default: true })
  allow_overlap: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Shift, (shift) => shift.shift_template)
  shifts: Shift[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

