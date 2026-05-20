import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { ClientOnboarding } from './client-onboarding.entity';
import { Blueprint } from './blueprint.entity';
import { BlueprintVersion } from './blueprint-version.entity';

export const CLIENT_BLUEPRINT_ASSIGNMENT_STATUSES = ['assigned', 'applied', 'failed'] as const;
export type ClientBlueprintAssignmentStatus = (typeof CLIENT_BLUEPRINT_ASSIGNMENT_STATUSES)[number];

@Entity('client_blueprint_assignments')
export class ClientBlueprintAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => ClientOnboarding, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'onboarding_id' })
  onboarding: ClientOnboarding | null;

  @Column({ name: 'onboarding_id', type: 'int', nullable: true })
  onboarding_id: number | null;

  @ManyToOne(() => Blueprint, (blueprint) => blueprint.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint: Blueprint;

  @Column({ name: 'blueprint_id', type: 'char', length: 36 })
  blueprint_id: string;

  @ManyToOne(() => BlueprintVersion, (version) => version.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_version_id' })
  blueprint_version: BlueprintVersion;

  @Column({ name: 'blueprint_version_id', type: 'int' })
  blueprint_version_id: number;

  @Column({
    name: 'assignment_status',
    type: 'enum',
    enum: CLIENT_BLUEPRINT_ASSIGNMENT_STATUSES,
    default: 'assigned',
  })
  assignment_status: ClientBlueprintAssignmentStatus;

  @Column({ name: 'assigned_by', type: 'varchar', length: 255, nullable: true })
  assigned_by: string | null;

  @Column({ name: 'applied_by', type: 'varchar', length: 255, nullable: true })
  applied_by: string | null;

  @Column({ name: 'applied_at', type: 'datetime', nullable: true })
  applied_at: Date | null;

  @Column({ name: 'failure_summary', type: 'text', nullable: true })
  failure_summary: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}

