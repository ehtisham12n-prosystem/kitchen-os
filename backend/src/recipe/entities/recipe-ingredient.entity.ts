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
import { Recipe } from './recipe.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('recipe_ingredients')
@Index(['recipe_id'])
export class RecipeIngredient {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Recipe)
    @JoinColumn({ name: 'recipe_id' })
    recipe: Recipe;

    @Column({ name: 'recipe_id' })
    recipe_id: number;

    @ManyToOne(() => InventoryItem)
    @JoinColumn({ name: 'item_id' })
    item: InventoryItem;

    @Column({ name: 'item_id' })
    item_id: number;

    @Column({
        name: 'quantity',
        type: 'decimal',
        precision: 10,
        scale: 4,
        default: 0,
    })
    quantity: number;

    @Column({ name: 'uom', length: 50 })
    uom: string; // Ingredient unit (e.g., "kg", "grams")

    @Column({
        name: 'wastage_percentage',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 0,
    })
    wastage_percentage: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
