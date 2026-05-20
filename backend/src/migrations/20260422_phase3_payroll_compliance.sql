CREATE TABLE IF NOT EXISTS accounting_payroll_compliance_settings (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,
  income_tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  income_tax_threshold DECIMAL(15,2) NOT NULL DEFAULT 0,
  eobi_employee_fixed DECIMAL(15,2) NOT NULL DEFAULT 0,
  eobi_employer_fixed DECIMAL(15,2) NOT NULL DEFAULT 0,
  social_security_employee_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  social_security_employer_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  social_security_salary_cap DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounting_payroll_compliance_branch (client_id, branch_id),
  CONSTRAINT fk_accounting_payroll_compliance_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
);

ALTER TABLE accounting_payroll_runs
  ADD COLUMN IF NOT EXISTS total_income_tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_loan_recovery_amount,
  ADD COLUMN IF NOT EXISTS total_eobi_employee_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_income_tax_amount,
  ADD COLUMN IF NOT EXISTS total_eobi_employer_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_eobi_employee_amount,
  ADD COLUMN IF NOT EXISTS total_social_security_employee_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_eobi_employer_amount,
  ADD COLUMN IF NOT EXISTS total_social_security_employer_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_social_security_employee_amount,
  ADD COLUMN IF NOT EXISTS total_employee_compliance_deduction_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_social_security_employer_amount,
  ADD COLUMN IF NOT EXISTS total_employer_contribution_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_employee_compliance_deduction_amount;

ALTER TABLE accounting_payroll_run_lines
  ADD COLUMN IF NOT EXISTS income_tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER loan_recovery_amount,
  ADD COLUMN IF NOT EXISTS eobi_employee_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER income_tax_amount,
  ADD COLUMN IF NOT EXISTS eobi_employer_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER eobi_employee_amount,
  ADD COLUMN IF NOT EXISTS social_security_employee_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER eobi_employer_amount,
  ADD COLUMN IF NOT EXISTS social_security_employer_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER social_security_employee_amount,
  ADD COLUMN IF NOT EXISTS employee_compliance_deduction_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER social_security_employer_amount,
  ADD COLUMN IF NOT EXISTS employer_contribution_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER employee_compliance_deduction_amount;
