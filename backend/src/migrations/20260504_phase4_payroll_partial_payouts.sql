ALTER TABLE `accounting_payroll_runs`
  MODIFY COLUMN `status` ENUM('draft','approved','partially_paid','paid','void') NOT NULL DEFAULT 'draft',
  ADD COLUMN `total_paid_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `total_net_amount`,
  ADD COLUMN `total_payable_balance` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `total_paid_amount`;

ALTER TABLE `accounting_payroll_run_lines`
  ADD COLUMN `payable_days` INT NOT NULL DEFAULT 0 AFTER `working_minutes`,
  ADD COLUMN `paid_days` INT NOT NULL DEFAULT 0 AFTER `net_amount`,
  ADD COLUMN `paid_amount` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `paid_days`,
  ADD COLUMN `payable_balance` DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER `paid_amount`,
  ADD COLUMN `payout_status` VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER `payable_balance`,
  ADD COLUMN `paid_at` DATETIME NULL AFTER `payout_status`,
  ADD COLUMN `paid_by` INT NULL AFTER `paid_at`;

UPDATE `accounting_payroll_runs`
SET `total_paid_amount` = CASE WHEN `status` = 'paid' THEN COALESCE(`total_net_amount`, 0) ELSE 0 END,
    `total_payable_balance` = CASE
      WHEN `status` = 'paid' THEN 0
      WHEN `status` IN ('approved', 'draft') THEN COALESCE(`total_net_amount`, 0)
      ELSE COALESCE(`total_payable_balance`, 0)
    END;

UPDATE `accounting_payroll_run_lines`
SET `payable_days` = COALESCE(`present_days`, 0) + COALESCE(`late_days`, 0) + COALESCE(`leave_days`, 0),
    `paid_days` = 0,
    `paid_amount` = 0,
    `payable_balance` = COALESCE(`net_amount`, 0),
    `payout_status` = 'unpaid';

UPDATE `accounting_payroll_run_lines` line
INNER JOIN `accounting_payroll_runs` run ON run.`id` = line.`payroll_run_id`
SET line.`paid_days` = line.`payable_days`,
    line.`paid_amount` = COALESCE(line.`net_amount`, 0),
    line.`payable_balance` = 0,
    line.`payout_status` = 'paid',
    line.`paid_at` = run.`paid_at`,
    line.`paid_by` = run.`paid_by`
WHERE run.`status` = 'paid';
