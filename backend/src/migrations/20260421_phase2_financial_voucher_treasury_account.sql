ALTER TABLE `financial_vouchers`
  ADD COLUMN IF NOT EXISTS `treasury_account_id` int NULL AFTER `expense_account_id`;
