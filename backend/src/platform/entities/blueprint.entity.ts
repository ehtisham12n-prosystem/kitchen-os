import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlueprintVersion } from './blueprint-version.entity';
import { ClientBlueprintAssignment } from './client-blueprint-assignment.entity';

export const BLUEPRINT_STATUSES = ['draft', 'active', 'retired'] as const;
export type BlueprintStatus = (typeof BLUEPRINT_STATUSES)[number];

@Entity('blueprints')
export class Blueprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'blueprint_code', length: 60, unique: true })
  blueprint_code: string;

  @Column({ name: 'blueprint_name', length: 150 })
  blueprint_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'blueprint_status',
    type: 'enum',
    enum: BLUEPRINT_STATUSES,
    default: 'draft',
  })
  status: BlueprintStatus;

  @Column({ name: 'active_version_id', type: 'int', nullable: true })
  active_version_id: number | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => BlueprintVersion, (version) => version.blueprint)
  versions: BlueprintVersion[];

  @OneToMany(() => ClientBlueprintAssignment, (assignment) => assignment.blueprint)
  assignments: ClientBlueprintAssignment[];
}
