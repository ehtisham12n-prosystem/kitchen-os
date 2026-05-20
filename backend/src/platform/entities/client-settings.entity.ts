import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import type { ClientNumberingSettings } from '../../setup/branches/branch-config.types';

@Entity('client_settings')
export class ClientSettings {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @Column({ name: 'company_logo_url', nullable: true })
    logo_url: string;

    @Column({ name: 'short_logo_url', type: 'text', nullable: true })
    short_logo_url: string | null;

    @Column({ name: 'login_background_url', type: 'text', nullable: true })
    login_background_url: string | null;

    @Column({ name: 'receipt_business_name', type: 'varchar', length: 150, nullable: true })
    receipt_business_name: string | null;

    @Column({ name: 'receipt_footer_message_1', type: 'varchar', length: 255, nullable: true })
    receipt_footer_message_1: string | null;

    @Column({ name: 'receipt_footer_message_2', type: 'varchar', length: 255, nullable: true })
    receipt_footer_message_2: string | null;

    @Column({ name: 'show_receipt_full_logo', type: 'boolean', default: true })
    show_receipt_full_logo: boolean;

    @Column({ name: 'show_receipt_short_logo', type: 'boolean', default: false })
    show_receipt_short_logo: boolean;

    @Column({ name: 'show_receipt_business_name', type: 'boolean', default: true })
    show_receipt_business_name: boolean;

    @Column({ name: 'show_receipt_branch_name', type: 'boolean', default: true })
    show_receipt_branch_name: boolean;

    @Column({ name: 'show_receipt_branch_address', type: 'boolean', default: true })
    show_receipt_branch_address: boolean;

    @Column({ name: 'show_receipt_contact_number', type: 'boolean', default: true })
    show_receipt_contact_number: boolean;

    @Column({ name: 'show_receipt_footer_message_1', type: 'boolean', default: true })
    show_receipt_footer_message_1: boolean;

    @Column({ name: 'show_receipt_footer_message_2', type: 'boolean', default: false })
    show_receipt_footer_message_2: boolean;

    @Column({ name: 'show_kot_full_logo', type: 'boolean', default: false })
    show_kot_full_logo: boolean;

    @Column({ name: 'show_kot_short_logo', type: 'boolean', default: false })
    show_kot_short_logo: boolean;

    @Column({ name: 'show_kot_business_name', type: 'boolean', default: true })
    show_kot_business_name: boolean;

    @Column({ name: 'show_kot_branch_name', type: 'boolean', default: true })
    show_kot_branch_name: boolean;

    @Column({ name: 'show_kot_branch_address', type: 'boolean', default: false })
    show_kot_branch_address: boolean;

    @Column({ name: 'show_kot_contact_number', type: 'boolean', default: false })
    show_kot_contact_number: boolean;

    @Column({ name: 'show_kot_footer_message_1', type: 'boolean', default: false })
    show_kot_footer_message_1: boolean;

    @Column({ name: 'show_kot_footer_message_2', type: 'boolean', default: false })
    show_kot_footer_message_2: boolean;

    @Column({ name: 'show_login_full_logo', type: 'boolean', default: true })
    show_login_full_logo: boolean;

    @Column({ name: 'show_login_business_name', type: 'boolean', default: true })
    show_login_business_name: boolean;

    @Column({ name: 'show_login_branch_name', type: 'boolean', default: true })
    show_login_branch_name: boolean;

    @Column({ name: 'show_header_short_logo', type: 'boolean', default: true })
    show_header_short_logo: boolean;

    @Column({ name: 'receipt_paper_size', type: 'varchar', length: 20, default: 'thermal-80mm' })
    receipt_paper_size: string;

    @Column({ name: 'invoice_paper_size', type: 'varchar', length: 20, default: 'a4' })
    invoice_paper_size: string;

    @Column({ name: 'kot_paper_size', type: 'varchar', length: 20, default: 'thermal-80mm' })
    kot_paper_size: string;

    @Column({ name: 'report_paper_size', type: 'varchar', length: 20, default: 'a4' })
    report_paper_size: string;

    @Column({ name: 'receipt_print_copies', type: 'int', default: 1 })
    receipt_print_copies: number;

    @Column({ name: 'invoice_print_copies', type: 'int', default: 1 })
    invoice_print_copies: number;

    @Column({ name: 'kot_print_copies', type: 'int', default: 1 })
    kot_print_copies: number;

    @Column({ name: 'kot_print_enabled', type: 'boolean', default: true })
    kot_print_enabled: boolean;

    @Column({ name: 'report_print_copies', type: 'int', default: 1 })
    report_print_copies: number;

    @Column({ name: 'order_change_print_mode', type: 'varchar', length: 20, default: 'change_only' })
    order_change_print_mode: string;

    @Column({ name: 'order_change_print_copies', type: 'int', default: 1 })
    order_change_print_copies: number;

    @Column({ name: 'enable_station_wise_kot_printing', type: 'boolean', default: false })
    enable_station_wise_kot_printing: boolean;

    @Column({ name: 'allow_multiple_kot_per_station', type: 'boolean', default: false })
    allow_multiple_kot_per_station: boolean;

    @Column({ name: 'service_station_print_copies', type: 'json', nullable: true })
    service_station_print_copies: Record<string, number> | null;

    @Column({ name: 'station_printer_mapping', type: 'json', nullable: true })
    station_printer_mapping: Record<string, string> | null;

    @Column({ name: 'separate_kot_stations', type: 'json', nullable: true })
    separate_kot_stations: string[] | null;

    @Column({ name: 'numbering_settings', type: 'json', nullable: true })
    numbering_settings: ClientNumberingSettings | null;

    @Column({ name: 'default_currency', length: 10, default: 'USD' })
    currency: string;

    @Column({ name: 'timezone', length: 50, default: 'UTC' })
    timezone: string;

    @Column({ name: 'fiscal_year_start_month', type: 'int', default: 1 })
    fiscal_year_start: number;

    @Column({ name: 'contact_email', nullable: true })
    contact_email: string;

    @Column({ name: 'contact_phone', nullable: true })
    contact_phone: string;

    @Column({ type: 'text', nullable: true })
    address: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

