import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Blueprint } from './blueprint.entity';
import { ClientBlueprintAssignment } from './client-blueprint-assignment.entity';
import { BlueprintApplicationLog } from './blueprint-application-log.entity';

@Entity('blueprint_versions')
export class BlueprintVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Blueprint, (blueprint) => blueprint.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_id' })
  blueprint: Blueprint;

  @Column({ name: 'blueprint_id', type: 'char', length: 36 })
  blueprint_id: string;

  @Column({ name: 'version_no', type: 'int' })
  version_no: number;

  @Column({ name: 'payload_json', type: 'longtext' })
  payload_json: string;

  @Column({ name: 'schema_version', length: 20, default: 'v1' })
  schema_version: string;

  @Column({ name: 'release_notes', type: 'text', nullable: true })
  release_notes: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @OneToMany(() => ClientBlueprintAssignment, (assignment) => assignment.blueprint_version)
  assignments: ClientBlueprintAssignment[];

  @OneToMany(() => BlueprintApplicationLog, (log) => log.blueprint_version)
  application_logs: BlueprintApplicationLog[];
}
