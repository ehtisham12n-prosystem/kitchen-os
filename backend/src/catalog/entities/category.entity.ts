import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../platform/entities/client.entity';

@Entity('categories')
@Index(['client_id']) // Used to quickly fetch all categories for a client's POS
@Index(['client_id', 'is_active'])
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
  client: Client;

  @Column({ name: 'client_id', type: 'varchar', length: 20 })
  client_id: string;

  @Column({ name: 'category_name', length: 150 })
  category_name: string;

  @Column({ name: 'category_description', type: 'text', nullable: true })
  category_description: string;

  @Column({ name: 'category_sort_order', type: 'int', default: 0 })
  category_sort_order: number; // For ordering on the POS screen

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'parent_category_id' })
  parent_category: Category;

  @Column({ name: 'parent_category_id', nullable: true })
  parent_category_id: number;

  @Column({ name: 'branch_availability', type: 'json', nullable: true })
  branchAvailability: Record<string, boolean>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

