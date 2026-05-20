ALTER TABLE `accounting_coa`
  ADD COLUMN `bank_name` varchar(150) DEFAULT NULL AFTER `account_name`,
  ADD COLUMN `account_title` varchar(150) DEFAULT NULL AFTER `bank_name`,
  ADD COLUMN `account_number_iban` varchar(60) DEFAULT NULL AFTER `account_title`,
  ADD COLUMN `currency_code` varchar(10) DEFAULT NULL AFTER `account_number_iban`,
  ADD COLUMN `bank_account_type` varchar(20) DEFAULT NULL AFTER `currency_code`;
