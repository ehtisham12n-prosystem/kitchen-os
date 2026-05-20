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
import { Client } from '../../platform/entities/client.entity';
import { Branch } from '../../setup/entities/branch.entity';

@Entity('accounting_payroll_compliance_settings')
@Index(['client_id', 'branch_id'], { unique: true })
export class AccountingPayrollComplianceSetting {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', type: 'varchar', length: 20 })
    client_id: string;

    @ManyToOne(() => Branch)
    @JoinColumn({ name: 'branch_id' })
    branch: Branch;

    @Column({ name: 'branch_id', type: 'int' })
    branch_id: number;

    @Column({ name: 'income_tax_rate', type: 'decimal', precision: 8, scale: 4, default: 0 })
    income_tax_rate: number;

    @Column({ name: 'income_tax_threshold', type: 'decimal', precision: 15, scale: 2, default: 0 })
    income_tax_threshold: number;

    @Column({ name: 'eobi_employee_fixed', type: 'decimal', precision: 15, scale: 2, default: 0 })
    eobi_employee_fixed: number;

    @Column({ name: 'eobi_employer_fixed', type: 'decimal', precision: 15, scale: 2, default: 0 })
    eobi_employer_fixed: number;

    @Column({ name: 'social_security_employee_rate', type: 'decimal', precision: 8, scale: 4, default: 0 })
    social_security_employee_rate: number;

    @Column({ name: 'social_security_employer_rate', type: 'decimal', precision: 8, scale: 4, default: 0 })
    social_security_employer_rate: number;

    @Column({ name: 'social_security_salary_cap', type: 'decimal', precision: 15, scale: 2, default: 0 })
    social_security_salary_cap: number;

    @Column({ name: 'notes', type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    is_active: boolean;

    @Column({ name: 'updated_by', type: 'int', nullable: true })
    updated_by: number | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
