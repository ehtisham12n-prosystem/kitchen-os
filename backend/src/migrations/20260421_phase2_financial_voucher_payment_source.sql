ALTER TABLE `financial_vouchers`
  ADD COLUMN IF NOT EXISTS `payment_source_label` varchar(120) NULL AFTER `payment_method`;
