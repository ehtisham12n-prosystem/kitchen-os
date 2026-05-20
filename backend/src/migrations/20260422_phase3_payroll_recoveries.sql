CREATE TABLE IF NOT EXISTS accounting_payroll_recovery_profiles (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,
  user_id INT NOT NULL,
  advance_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  loan_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  default_advance_recovery DECIMAL(15,2) NOT NULL DEFAULT 0,
  default_loan_recovery DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounting_payroll_recovery_profiles_scope (client_id, branch_id, user_id),
  KEY idx_accounting_payroll_recovery_profiles_branch (client_id, branch_id),
  CONSTRAINT fk_accounting_payroll_recovery_profiles_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_accounting_payroll_recovery_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE accounting_payroll_runs
  ADD COLUMN IF NOT EXISTS total_attendance_deduction_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_gross_amount,
  ADD COLUMN IF NOT EXISTS total_advance_recovery_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_attendance_deduction_amount,
  ADD COLUMN IF NOT EXISTS total_loan_recovery_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_advance_recovery_amount;

ALTER TABLE accounting_payroll_run_lines
  ADD COLUMN IF NOT EXISTS attendance_deduction_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER gross_amount,
  ADD COLUMN IF NOT EXISTS advance_recovery_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER attendance_deduction_amount,
  ADD COLUMN IF NOT EXISTS loan_recovery_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER advance_recovery_amount;

UPDATE accounting_payroll_runs
SET total_attendance_deduction_amount = COALESCE(total_deduction_amount, 0)
WHERE COALESCE(total_attendance_deduction_amount, 0) = 0
  AND COALESCE(total_deduction_amount, 0) > 0;

UPDATE accounting_payroll_run_lines
SET attendance_deduction_amount = COALESCE(deduction_amount, 0)
WHERE COALESCE(attendance_deduction_amount, 0) = 0
  AND COALESCE(deduction_amount, 0) > 0;
