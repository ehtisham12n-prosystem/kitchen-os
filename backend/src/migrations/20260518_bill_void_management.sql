ALTER TABLE `pos_void_logs`
  ADD COLUMN IF NOT EXISTS `client_id` varchar(20) NULL AFTER `order_id`,
  ADD COLUMN IF NOT EXISTS `branch_id` int NULL AFTER `client_id`,
  ADD COLUMN IF NOT EXISTS `order_number` varchar(50) NULL AFTER `branch_id`,
  ADD COLUMN IF NOT EXISTS `receipt_number` varchar(50) NULL AFTER `order_number`,
  ADD COLUMN IF NOT EXISTS `customer_id` int NULL AFTER `receipt_number`,
  ADD COLUMN IF NOT EXISTS `customer_name` varchar(150) NULL AFTER `customer_id`,
  ADD COLUMN IF NOT EXISTS `order_amount` decimal(12,2) NOT NULL DEFAULT 0.00 AFTER `customer_name`,
  ADD COLUMN IF NOT EXISTS `voided_amount` decimal(12,2) NOT NULL DEFAULT 0.00 AFTER `order_amount`,
  ADD COLUMN IF NOT EXISTS `voided_by_user_id` int NULL AFTER `approved_by`,
  ADD COLUMN IF NOT EXISTS `voided_by_username` varchar(150) NULL AFTER `voided_by_user_id`,
  ADD COLUMN IF NOT EXISTS `voided_by_role` varchar(150) NULL AFTER `voided_by_username`,
  ADD COLUMN IF NOT EXISTS `sale_counter_id` int NULL AFTER `voided_by_role`,
  ADD COLUMN IF NOT EXISTS `sale_counter_name` varchar(150) NULL AFTER `sale_counter_id`,
  ADD COLUMN IF NOT EXISTS `original_payment_method` varchar(80) NULL AFTER `sale_counter_name`,
  ADD COLUMN IF NOT EXISTS `original_order_status` varchar(40) NULL AFTER `original_payment_method`,
  ADD COLUMN IF NOT EXISTS `original_payment_status` varchar(40) NULL AFTER `original_order_status`;

CREATE INDEX `IDX_pos_void_logs_scope` ON `pos_void_logs` (`client_id`, `branch_id`, `created_at`);
CREATE INDEX `IDX_pos_void_logs_customer` ON `pos_void_logs` (`client_id`, `customer_id`, `created_at`);

INSERT INTO `permissions` (`key`, `module`, `action`, `scope`, `created_at`, `updated_at`)
VALUES
  ('bill_void.view.branch', 'bill_void', 'view', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('bill_void.create.branch', 'bill_void', 'create', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('bill_void.approve.branch', 'bill_void', 'approve', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('bill_void.export.branch', 'bill_void', 'export', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('bill_void.manage.branch', 'bill_void', 'manage', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  `module` = VALUES(`module`),
  `action` = VALUES(`action`),
  `scope` = VALUES(`scope`),
  `updated_at` = CURRENT_TIMESTAMP(6);
