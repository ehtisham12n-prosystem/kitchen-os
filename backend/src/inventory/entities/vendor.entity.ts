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

@Entity('vendors')
@Index(['client_id'])
export class Vendor {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'vendor_name', length: 200 })
    vendor_name: string;

    @Column({ name: 'contact_person', length: 100, nullable: true })
    contact_person: string;

    @Column({ name: 'email', length: 150, nullable: true })
    email: string;

    @Column({ name: 'phone', length: 50, nullable: true })
    phone: string;

    @Column({ name: 'address', type: 'text', nullable: true })
    address: string;

    @Column({ name: 'tax_id', length: 100, nullable: true })
    tax_id: string;

    @Column({ name: 'payment_terms', length: 100, nullable: true })
    payment_terms: string; // e.g., "Net 30", "Cash on Delivery"

    // Legacy field mappings retained for safe transition
    @Column({ name: 'contact_email', length: 150, nullable: true })
    contact_email: string;

    @Column({ name: 'contact_phone', length: 50, nullable: true })
    contact_phone: string;

    @Column({ name: 'vendor_address', type: 'text', nullable: true })
    vendor_address: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

