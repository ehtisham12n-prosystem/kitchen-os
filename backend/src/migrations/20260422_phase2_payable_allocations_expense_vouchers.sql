ALTER TABLE `accounting_payable_allocations`
  MODIFY COLUMN `grn_id` int NULL;

ALTER TABLE `accounting_payable_allocations`
  ADD COLUMN IF NOT EXISTS `payable_voucher_id` int NULL AFTER `grn_id`;

CREATE INDEX `IDX_accounting_payable_allocations_client_payable_voucher`
  ON `accounting_payable_allocations` (`client_id`, `payable_voucher_id`);
