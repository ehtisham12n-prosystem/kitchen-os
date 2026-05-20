ALTER TABLE `goods_receipt_notes`
  ADD COLUMN IF NOT EXISTS `vendor_bill_amount` decimal(15,4) NULL AFTER `vendor_bill_due_date`;
