ALTER TABLE `accounting_payroll_run_lines`
  ADD COLUMN `arrears_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `deduction_amount`;

UPDATE `accounting_payroll_run_lines`
SET `arrears_amount` = 0
WHERE `arrears_amount` IS NULL;
