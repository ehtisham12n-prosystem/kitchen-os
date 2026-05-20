import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('support_tickets')
export class SupportTicket {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'ticket_number', unique: true, length: 20 })
    ticket_number: string; // TKT-8042 style

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ length: 255 })
    subject: string;

    @Column({
        type: 'enum',
        enum: ['open', 'in_progress', 'resolved'],
        default: 'open',
    })
    status: string;

    @Column({
        type: 'enum',
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    })
    priority: string;

    @Column({ name: 'created_by', nullable: true })
    created_by: string; // The specific person/sys-UserManagement who created it if relevant

    @OneToMany(() => TicketMessage, (message) => message.ticket)
    messages: TicketMessage[];

    @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
    resolved_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

@Entity('ticket_messages')
export class TicketMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => SupportTicket, (ticket) => ticket.messages)
    @JoinColumn({ name: 'ticket_id' })
    ticket: SupportTicket;

    @Column({ name: 'ticket_id' })
    ticket_id: string;

    @Column({ type: 'text' })
    text: string;

    @Column({
        type: 'enum',
        enum: ['client', 'support'],
        default: 'client',
    })
    sender: string;

    @Column({ name: 'author_id', nullable: true })
    author_id: string; // ID of either SystemUserManagement or ClientUserManagement

    @Column({ name: 'author_name', length: 150, nullable: true })
    author_name: string; // Flat name for displays

    @CreateDateColumn({ name: 'timestamp' })
    timestamp: Date;
}

