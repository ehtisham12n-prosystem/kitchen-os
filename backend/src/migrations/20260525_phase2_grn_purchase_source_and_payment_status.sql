ALTER TABLE `goods_receipt_notes`
  ADD COLUMN IF NOT EXISTS `purchase_source_type` enum('PO','NON_PO') NOT NULL DEFAULT 'PO' AFTER `vendor_id`,
  ADD COLUMN IF NOT EXISTS `payment_status` enum('PAID','PARTIAL_PAID','CREDIT') NOT NULL DEFAULT 'CREDIT' AFTER `payable_status`,
  ADD COLUMN IF NOT EXISTS `paid_amount` decimal(18,2) NULL AFTER `payment_status`,
  ADD COLUMN IF NOT EXISTS `outstanding_amount` decimal(18,2) NULL AFTER `paid_amount`,
  ADD COLUMN IF NOT EXISTS `payment_method` varchar(100) NULL AFTER `outstanding_amount`,
  ADD COLUMN IF NOT EXISTS `payment_reference` varchar(255) NULL AFTER `payment_method`,
  ADD COLUMN IF NOT EXISTS `payment_date` date NULL AFTER `payment_reference`,
  ADD COLUMN IF NOT EXISTS `payment_source` varchar(100) NULL AFTER `payment_date`;
