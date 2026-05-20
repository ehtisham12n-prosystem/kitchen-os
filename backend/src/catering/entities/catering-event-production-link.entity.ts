import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';
import { CateringEvent } from './catering-event.entity';

@Entity('catering_event_production_links')
@Index(['client_id', 'event_id'])
@Index(['client_id', 'production_order_id'], { unique: true })
export class CateringEventProductionLink {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @ManyToOne(() => CateringEvent, (event) => event.production_links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CateringEvent;

  @Column({ name: 'event_id', type: 'int' })
  event_id: number;

  @Column({ name: 'production_order_id', type: 'int' })
  production_order_id: number;

  @Column({ name: 'event_item_id', type: 'int' })
  event_item_id: number;

  @Column({ name: 'source_branch_id', type: 'int' })
  source_branch_id: number;

  @Column({ name: 'destination_branch_id', type: 'int' })
  destination_branch_id: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}

