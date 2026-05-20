CREATE TABLE IF NOT EXISTS `accounting_coa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `account_code` varchar(20) NOT NULL,
  `account_name` varchar(150) NOT NULL,
  `account_type` enum('asset','liability','equity','revenue','expense') NOT NULL,
  `parent_id` int DEFAULT NULL,
  `branch_id` int DEFAULT NULL,
  `scope` enum('company','branch') NOT NULL DEFAULT 'company',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_accounting_coa_client_code` (`client_id`, `account_code`),
  KEY `IDX_accounting_coa_parent` (`parent_id`),
  KEY `IDX_accounting_coa_branch` (`branch_id`),
  CONSTRAINT `FK_accounting_coa_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_accounting_coa_parent` FOREIGN KEY (`parent_id`) REFERENCES `accounting_coa` (`id`),
  CONSTRAINT `FK_accounting_coa_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
);

CREATE TABLE IF NOT EXISTS `accounting_day_closes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `business_date` date NOT NULL,
  `closed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_by_user_id` int DEFAULT NULL,
  `closed_by_name` varchar(150) DEFAULT NULL,
  `shift_id` int DEFAULT NULL,
  `order_count` int NOT NULL DEFAULT 0,
  `gross_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `other_charges_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `net_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `cash_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `bank_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `card_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `digital_wallet_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `other_payment_sales_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `inventory_issue_cost_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `wastage_cost_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `expected_cash_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `actual_cash_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `cash_variance_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `journal_entry_count` int NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_accounting_day_closes_branch_date` (`client_id`, `branch_id`, `business_date`),
  KEY `IDX_accounting_day_closes_closed_at` (`client_id`, `branch_id`, `closed_at`),
  CONSTRAINT `FK_accounting_day_closes_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_accounting_day_closes_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
);

CREATE TABLE IF NOT EXISTS `accounting_journal_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `transaction_date` datetime NOT NULL,
  `business_date` date NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `source_module` varchar(40) DEFAULT NULL,
  `source_entity_type` varchar(40) DEFAULT NULL,
  `source_entity_id` varchar(64) DEFAULT NULL,
  `source_event` varchar(40) DEFAULT NULL,
  `posting_type` enum('manual','auto','closing') NOT NULL DEFAULT 'manual',
  `day_close_id` int DEFAULT NULL,
  `total_debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_accounting_journal_entries_branch` (`client_id`, `branch_id`),
  KEY `IDX_accounting_journal_entries_date` (`client_id`, `branch_id`, `business_date`),
  CONSTRAINT `FK_accounting_journal_entries_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_accounting_journal_entries_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_accounting_journal_entries_day_close` FOREIGN KEY (`day_close_id`) REFERENCES `accounting_day_closes` (`id`)
);

CREATE TABLE IF NOT EXISTS `accounting_journal_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_id` int NOT NULL,
  `account_id` int NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `IDX_accounting_journal_items_entry` (`entry_id`),
  KEY `IDX_accounting_journal_items_account` (`account_id`),
  CONSTRAINT `FK_accounting_journal_items_entry` FOREIGN KEY (`entry_id`) REFERENCES `accounting_journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_accounting_journal_items_account` FOREIGN KEY (`account_id`) REFERENCES `accounting_coa` (`id`)
);

CREATE TABLE IF NOT EXISTS `financial_vouchers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `voucher_no` varchar(50) NOT NULL,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int DEFAULT NULL,
  `type` enum('EXPENSE','PAYMENT','COMPENSATION') NOT NULL DEFAULT 'EXPENSE',
  `party_type` enum('VENDOR','EMPLOYEE','OTHER') NOT NULL DEFAULT 'OTHER',
  `party_id` varchar(50) DEFAULT NULL,
  `party_name` varchar(200) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `date` date NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','VOID') NOT NULL DEFAULT 'PENDING',
  `reference_no` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_financial_vouchers_no` (`voucher_no`),
  KEY `IDX_financial_vouchers_branch` (`client_id`, `branch_id`),
  CONSTRAINT `FK_financial_vouchers_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_financial_vouchers_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
);

ALTER TABLE `accounting_journal_entries`
  ADD COLUMN IF NOT EXISTS `business_date` date NULL AFTER `transaction_date`,
  ADD COLUMN IF NOT EXISTS `source_module` varchar(40) NULL AFTER `reference_id`,
  ADD COLUMN IF NOT EXISTS `source_entity_type` varchar(40) NULL AFTER `source_module`,
  ADD COLUMN IF NOT EXISTS `source_entity_id` varchar(64) NULL AFTER `source_entity_type`,
  ADD COLUMN IF NOT EXISTS `source_event` varchar(40) NULL AFTER `source_entity_id`,
  ADD COLUMN IF NOT EXISTS `posting_type` enum('manual','auto','closing') NOT NULL DEFAULT 'manual' AFTER `source_event`,
  ADD COLUMN IF NOT EXISTS `day_close_id` int NULL AFTER `posting_type`,
  ADD COLUMN IF NOT EXISTS `total_debit` decimal(15,2) NOT NULL DEFAULT 0.00 AFTER `day_close_id`,
  ADD COLUMN IF NOT EXISTS `total_credit` decimal(15,2) NOT NULL DEFAULT 0.00 AFTER `total_debit`;

ALTER TABLE `accounting_day_closes`
  ADD COLUMN IF NOT EXISTS `other_charges_amount` decimal(15,2) NOT NULL DEFAULT 0.00 AFTER `tax_amount`,
  ADD COLUMN IF NOT EXISTS `wastage_cost_amount` decimal(15,2) NOT NULL DEFAULT 0.00 AFTER `inventory_issue_cost_amount`,
  ADD COLUMN IF NOT EXISTS `journal_entry_count` int NOT NULL DEFAULT 0 AFTER `cash_variance_amount`,
  ADD COLUMN IF NOT EXISTS `notes` text NULL AFTER `journal_entry_count`;

UPDATE `accounting_journal_entries`
SET `business_date` = DATE(`transaction_date`)
WHERE `business_date` IS NULL;

UPDATE `accounting_journal_entries` `entry`
LEFT JOIN (
  SELECT
    `entry_id`,
    COALESCE(SUM(`debit`), 0) AS `total_debit`,
    COALESCE(SUM(`credit`), 0) AS `total_credit`
  FROM `accounting_journal_items`
  GROUP BY `entry_id`
) `totals` ON `totals`.`entry_id` = `entry`.`id`
SET
  `entry`.`total_debit` = COALESCE(`totals`.`total_debit`, 0),
  `entry`.`total_credit` = COALESCE(`totals`.`total_credit`, 0)
WHERE (`entry`.`total_debit` IS NULL OR `entry`.`total_credit` IS NULL OR (`entry`.`total_debit` = 0 AND `entry`.`total_credit` = 0));

UPDATE `accounting_journal_entries`
SET `posting_type` = 'manual'
WHERE `posting_type` IS NULL OR `posting_type` = '';
