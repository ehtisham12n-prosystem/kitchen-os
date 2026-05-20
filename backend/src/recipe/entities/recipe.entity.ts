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
import { Product } from '../../catalog/entities/product.entity';

@Entity('recipes')
@Index(['client_id', 'product_id'])
export class Recipe {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column({ name: 'product_id' })
    product_id: number;

    @Column({ name: 'recipe_name', length: 150 })
    recipe_name: string;

    @Column({
        name: 'yield_quantity',
        type: 'decimal',
        precision: 10,
        scale: 3,
        default: 1.0,
    })
    yield_quantity: number;

    @Column({ name: 'yield_uom', length: 50 })
    yield_uom: string; // e.g., "piece", "batch", "kg"

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string | null;

    @Column({ name: 'preparation_method', type: 'text', nullable: true })
    preparation_method: string | null;

    @Column({ name: 'serves_people', type: 'int', nullable: true })
    serves_people: number | null;

    @Column({ name: 'image_url', type: 'text', nullable: true })
    image_url: string | null;

    @Column({ name: 'prepared_by', type: 'varchar', length: 150, nullable: true })
    prepared_by: string | null;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'is_locked', type: 'boolean', default: false })
    is_locked: boolean;

    @Column({ name: 'locked_at', type: 'datetime', nullable: true })
    locked_at: Date | null;

    @Column({ name: 'locked_total_cost', type: 'decimal', precision: 15, scale: 4, nullable: true })
    locked_total_cost: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

