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
import { Client } from './client.entity';

export const CLIENT_CONTACT_TYPES = [
  'business_primary',
  'billing_primary',
  'operations_primary',
] as const;

export type ClientContactType = (typeof CLIENT_CONTACT_TYPES)[number];

@Entity('client_contacts')
@Index(['client_id', 'contact_type'], { unique: true })
export class ClientContact {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, (client) => client.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({
    name: 'contact_type',
    type: 'enum',
    enum: CLIENT_CONTACT_TYPES,
  })
  contact_type: ClientContactType;

  @Column({ name: 'full_name', length: 150 })
  full_name: string;

  @Column({ name: 'designation', type: 'varchar', length: 100, nullable: true })
  designation: string | null;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ name: 'alternate_phone', type: 'varchar', length: 50, nullable: true })
  alternate_phone: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;
}

