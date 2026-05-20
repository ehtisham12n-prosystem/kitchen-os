import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { ClientOnboarding } from './client-onboarding.entity';
import { Blueprint } from './blueprint.entity';
import { BlueprintVersion } from './blueprint-version.entity';
import { ClientBlueprintAssignment } from './client-blueprint-assignment.entity';

export const BLUEPRINT_APPLICATION_LOG_STATUSES = ['success', 'skipped', 'failed'] as const;
export type BlueprintApplicationLogStatus = (typeof BLUEPRINT_APPLICATION_LOG_STATUSES)[number];

@Entity('blueprint_application_logs')
export class BlueprintApplicationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientBlueprintAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: ClientBlueprintAssignment;

  @Column({ name: 'assignment_id', type: 'int' })
  assignment_id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => ClientOnboarding, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'onboarding_id' })
  onboarding: ClientOnboarding | null;

  @Column({ name: 'onboarding_id', type: 'int', nullable: true })
  onboarding_id: number | null;

  @ManyToOne(() => Blueprint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint: Blueprint;

  @Column({ name: 'blueprint_id', type: 'char', length: 36 })
  blueprint_id: string;

  @ManyToOne(() => BlueprintVersion, (version) => version.application_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_version_id' })
  blueprint_version: BlueprintVersion;

  @Column({ name: 'blueprint_version_id', type: 'int' })
  blueprint_version_id: number;

  @Column({ name: 'section_key', length: 50 })
  section_key: string;

  @Column({
    name: 'result_status',
    type: 'enum',
    enum: BLUEPRINT_APPLICATION_LOG_STATUSES,
    default: 'success',
  })
  result_status: BlueprintApplicationLogStatus;

  @Column({ name: 'message', length: 255 })
  message: string;

  @Column({ name: 'details_json', type: 'longtext', nullable: true })
  details_json: string | null;

  @Column({ name: 'executed_by', type: 'varchar', length: 255, nullable: true })
  executed_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}

