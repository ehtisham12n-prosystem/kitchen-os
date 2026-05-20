ALTER TABLE `accounting_coa`
  ADD COLUMN IF NOT EXISTS `schedule_code` varchar(30) NULL AFTER `is_active`,
  ADD COLUMN IF NOT EXISTS `is_control_account` tinyint(1) NOT NULL DEFAULT 0 AFTER `schedule_code`,
  ADD COLUMN IF NOT EXISTS `allow_manual_posting` tinyint(1) NOT NULL DEFAULT 1 AFTER `is_control_account`,
  ADD COLUMN IF NOT EXISTS `is_bank_account` tinyint(1) NOT NULL DEFAULT 0 AFTER `allow_manual_posting`,
  ADD COLUMN IF NOT EXISTS `is_cash_account` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_bank_account`;

INSERT INTO `accounting_coa` (
  `client_id`, `account_code`, `account_name`, `account_type`, `scope`, `is_active`,
  `schedule_code`, `is_control_account`, `allow_manual_posting`, `is_bank_account`, `is_cash_account`
)
SELECT DISTINCT
  `client_id`,
  '1210',
  'Accounts Receivable',
  'asset',
  'branch',
  1,
  'BS_RECEIVABLES',
  1,
  1,
  0,
  0
FROM `accounting_coa` existing
WHERE NOT EXISTS (
  SELECT 1
  FROM `accounting_coa` coa
  WHERE coa.`client_id` = existing.`client_id`
    AND coa.`account_code` = '1210'
);

INSERT INTO `accounting_coa` (
  `client_id`, `account_code`, `account_name`, `account_type`, `scope`, `is_active`,
  `schedule_code`, `is_control_account`, `allow_manual_posting`, `is_bank_account`, `is_cash_account`
)
SELECT DISTINCT
  `client_id`,
  '4500',
  'Bank Profit & Interest',
  'revenue',
  'company',
  1,
  'PL_OTHER_INCOME',
  0,
  1,
  0,
  0
FROM `accounting_coa` existing
WHERE NOT EXISTS (
  SELECT 1
  FROM `accounting_coa` coa
  WHERE coa.`client_id` = existing.`client_id`
    AND coa.`account_code` = '4500'
);

INSERT INTO `accounting_coa` (
  `client_id`, `account_code`, `account_name`, `account_type`, `scope`, `is_active`,
  `schedule_code`, `is_control_account`, `allow_manual_posting`, `is_bank_account`, `is_cash_account`
)
SELECT DISTINCT
  `client_id`,
  '5600',
  'Bank Charges',
  'expense',
  'company',
  1,
  'PL_BANKING',
  0,
  1,
  0,
  0
FROM `accounting_coa` existing
WHERE NOT EXISTS (
  SELECT 1
  FROM `accounting_coa` coa
  WHERE coa.`client_id` = existing.`client_id`
    AND coa.`account_code` = '5600'
);

UPDATE `accounting_coa`
SET
  `schedule_code` = CASE
    WHEN `account_code` IN ('1000', '1100', '1101', '1102', '1103', '1200', '1210', '1300', '1400') THEN COALESCE(`schedule_code`, 'BS_ASSETS')
    WHEN `account_code` IN ('2000', '2100', '2300', '2301', '2302') THEN COALESCE(`schedule_code`, 'BS_LIABILITIES')
    WHEN `account_code` IN ('3000', '3100', '3200') THEN COALESCE(`schedule_code`, 'BS_EQUITY')
    WHEN `account_code` IN ('4000', '4100', '4200', '4300', '4400', '4500') THEN COALESCE(`schedule_code`, 'PL_REVENUE')
    WHEN `account_code` IN ('5000', '5100', '5200', '5300', '5400', '5500', '5600', '5800') THEN COALESCE(`schedule_code`, 'PL_EXPENSES')
    ELSE `schedule_code`
  END,
  `is_control_account` = CASE WHEN `account_code` IN ('1210', '2100') THEN 1 ELSE `is_control_account` END,
  `is_bank_account` = CASE WHEN `account_code` = '1102' THEN 1 ELSE `is_bank_account` END,
  `is_cash_account` = CASE WHEN `account_code` = '1101' THEN 1 ELSE `is_cash_account` END;

ALTER TABLE `accounting_journal_entries`
  ADD COLUMN IF NOT EXISTS `reversed_entry_id` int NULL AFTER `total_credit`,
  ADD COLUMN IF NOT EXISTS `reversal_entry_id` int NULL AFTER `reversed_entry_id`,
  ADD COLUMN IF NOT EXISTS `reversal_reason` text NULL AFTER `reversal_entry_id`,
  ADD COLUMN IF NOT EXISTS `reversed_at` datetime NULL AFTER `reversal_reason`,
  ADD KEY `IDX_accounting_journal_entries_reversed_entry` (`reversed_entry_id`),
  ADD KEY `IDX_accounting_journal_entries_reversal_entry` (`reversal_entry_id`);

ALTER TABLE `accounting_journal_entries`
  ADD CONSTRAINT `FK_accounting_journal_entries_reversed_entry`
    FOREIGN KEY (`reversed_entry_id`) REFERENCES `accounting_journal_entries` (`id`),
  ADD CONSTRAINT `FK_accounting_journal_entries_reversal_entry`
    FOREIGN KEY (`reversal_entry_id`) REFERENCES `accounting_journal_entries` (`id`);

ALTER TABLE `financial_vouchers`
  ADD COLUMN IF NOT EXISTS `expense_account_id` int NULL AFTER `payment_method`,
  ADD COLUMN IF NOT EXISTS `posted_journal_entry_id` int NULL AFTER `created_by`,
  ADD COLUMN IF NOT EXISTS `reversal_journal_entry_id` int NULL AFTER `posted_journal_entry_id`,
  ADD COLUMN IF NOT EXISTS `approved_at` datetime NULL AFTER `reversal_journal_entry_id`,
  ADD COLUMN IF NOT EXISTS `approved_by` int NULL AFTER `approved_at`,
  ADD COLUMN IF NOT EXISTS `voided_at` datetime NULL AFTER `approved_by`,
  ADD COLUMN IF NOT EXISTS `voided_by` int NULL AFTER `voided_at`,
  ADD KEY `IDX_financial_vouchers_expense_account` (`expense_account_id`),
  ADD KEY `IDX_financial_vouchers_posted_entry` (`posted_journal_entry_id`),
  ADD KEY `IDX_financial_vouchers_reversal_entry` (`reversal_journal_entry_id`);

ALTER TABLE `financial_vouchers`
  ADD CONSTRAINT `FK_financial_vouchers_expense_account`
    FOREIGN KEY (`expense_account_id`) REFERENCES `accounting_coa` (`id`),
  ADD CONSTRAINT `FK_financial_vouchers_posted_entry`
    FOREIGN KEY (`posted_journal_entry_id`) REFERENCES `accounting_journal_entries` (`id`),
  ADD CONSTRAINT `FK_financial_vouchers_reversal_entry`
    FOREIGN KEY (`reversal_journal_entry_id`) REFERENCES `accounting_journal_entries` (`id`);

CREATE TABLE IF NOT EXISTS `accounting_payable_allocations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `grn_id` int NOT NULL,
  `voucher_id` int NOT NULL,
  `journal_entry_id` int DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `allocated_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `allocation_date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_accounting_payable_allocations_branch` (`client_id`, `branch_id`),
  KEY `IDX_accounting_payable_allocations_grn` (`client_id`, `grn_id`),
  KEY `IDX_accounting_payable_allocations_voucher` (`client_id`, `voucher_id`),
  CONSTRAINT `FK_accounting_payable_allocations_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_accounting_payable_allocations_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_accounting_payable_allocations_grn` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`),
  CONSTRAINT `FK_accounting_payable_allocations_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `financial_vouchers` (`id`),
  CONSTRAINT `FK_accounting_payable_allocations_journal_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `accounting_journal_entries` (`id`)
);

CREATE TABLE IF NOT EXISTS `accounting_bank_reconciliations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `account_id` int NOT NULL,
  `journal_entry_id` int NOT NULL,
  `journal_item_id` int NOT NULL,
  `statement_date` date NOT NULL,
  `statement_reference` varchar(100) NOT NULL,
  `statement_description` varchar(255) DEFAULT NULL,
  `reconciled_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `reconciled_by_user_id` int DEFAULT NULL,
  `reconciled_by_name` varchar(150) DEFAULT NULL,
  `reconciled_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_accounting_bank_reconciliations_journal_item` (`journal_item_id`),
  KEY `IDX_accounting_bank_reconciliations_account` (`client_id`, `branch_id`, `account_id`),
  CONSTRAINT `FK_accounting_bank_reconciliations_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_accounting_bank_reconciliations_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_accounting_bank_reconciliations_account` FOREIGN KEY (`account_id`) REFERENCES `accounting_coa` (`id`),
  CONSTRAINT `FK_accounting_bank_reconciliations_journal_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `accounting_journal_entries` (`id`),
  CONSTRAINT `FK_accounting_bank_reconciliations_journal_item` FOREIGN KEY (`journal_item_id`) REFERENCES `accounting_journal_items` (`id`)
);
