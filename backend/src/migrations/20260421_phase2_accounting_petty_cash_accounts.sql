ALTER TABLE `accounting_coa`
  ADD COLUMN `is_petty_cash_account` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_cash_account`;
