import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('kots')
export class KOT {
    @PrimaryColumn('uuid')
    id: string;

    @Column()
    client_id: string;

    @Column()
    branch_id: number;

    @Column()
    kot_number: string;

    @Column()
    order_id: string;

    @Column({ nullable: true })
    type: string;

    @Column({ type: 'text' })
    items_json: string;

    @Column({ default: 'Pending' })
    status: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
