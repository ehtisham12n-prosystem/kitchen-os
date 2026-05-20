ALTER TABLE `accounting_payroll_runs`
  ADD COLUMN `title` VARCHAR(180) NULL AFTER `run_no`;

ALTER TABLE `accounting_payroll_run_lines`
  MODIFY COLUMN `payout_status` VARCHAR(20) NOT NULL DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS `accounting_payroll_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `payroll_run_id` INT NOT NULL,
  `payroll_run_line_id` INT NOT NULL,
  `branch_id` INT NOT NULL,
  `user_id` INT NULL,
  `client_id` VARCHAR(20) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `treasury_account_id` INT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `reference_no` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `journal_entry_id` INT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_payments_run` (`payroll_run_id`),
  KEY `idx_payroll_payments_line` (`payroll_run_line_id`),
  KEY `idx_payroll_payments_branch` (`branch_id`),
  KEY `idx_payroll_payments_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `accounting_payroll_advances` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(20) NOT NULL,
  `branch_id` INT NOT NULL,
  `user_id` INT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL,
  `treasury_account_id` INT NULL,
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `reference_no` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `journal_entry_id` INT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_advances_branch` (`branch_id`),
  KEY `idx_payroll_advances_user` (`user_id`)
);
