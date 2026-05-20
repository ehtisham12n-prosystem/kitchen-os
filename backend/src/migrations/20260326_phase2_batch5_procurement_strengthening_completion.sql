ALTER TABLE `goods_receipt_notes`
  ADD COLUMN `vendor_bill_reference` varchar(100) NULL AFTER `vendor_invoice_number`,
  ADD COLUMN `vendor_bill_date` date NULL AFTER `vendor_bill_reference`,
  ADD COLUMN `vendor_bill_due_date` date NULL AFTER `vendor_bill_date`,
  ADD COLUMN `payment_terms_snapshot` varchar(100) NULL AFTER `vendor_bill_due_date`,
  ADD COLUMN `payable_status` enum('pending_bill','bill_received') NOT NULL DEFAULT 'pending_bill' AFTER `payment_terms_snapshot`;

UPDATE `goods_receipt_notes` grn
LEFT JOIN `vendors` vendor
  ON vendor.`id` = grn.`vendor_id`
SET
  grn.`vendor_bill_reference` = COALESCE(NULLIF(grn.`vendor_bill_reference`, ''), NULLIF(grn.`vendor_invoice_number`, '')),
  grn.`payment_terms_snapshot` = COALESCE(NULLIF(grn.`payment_terms_snapshot`, ''), NULLIF(vendor.`payment_terms`, '')),
  grn.`payable_status` = CASE
    WHEN COALESCE(NULLIF(grn.`vendor_bill_reference`, ''), NULLIF(grn.`vendor_invoice_number`, '')) IS NOT NULL
      THEN 'bill_received'
    ELSE 'pending_bill'
  END;

ALTER TABLE `goods_receipt_notes`
  ADD KEY `IDX_goods_receipt_notes_client_payable_status` (`client_id`, `payable_status`),
  ADD KEY `IDX_goods_receipt_notes_client_bill_reference` (`client_id`, `vendor_bill_reference`);
