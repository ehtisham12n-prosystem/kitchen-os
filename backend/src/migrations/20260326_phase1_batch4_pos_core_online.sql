ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `shift_id` int NULL AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `sale_counter_id` int NULL AFTER `shift_id`,
  ADD COLUMN IF NOT EXISTS `order_note` text NULL AFTER `payment_status`,
  ADD COLUMN IF NOT EXISTS `receipt_number` varchar(50) NULL AFTER `voucher_id`,
  ADD COLUMN IF NOT EXISTS `finalized_at` datetime NULL AFTER `receipt_number`,
  ADD COLUMN IF NOT EXISTS `finalized_by_user_id` int NULL AFTER `finalized_at`;

ALTER TABLE `transactions`
  MODIFY COLUMN `payment_mode` enum('cash','bank','card','digital_wallet','other') NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS `client_id` varchar(20) NULL AFTER `order_id`,
  ADD COLUMN IF NOT EXISTS `branch_id` int NULL AFTER `client_id`,
  ADD COLUMN IF NOT EXISTS `shift_id` int NULL AFTER `branch_id`,
  ADD COLUMN IF NOT EXISTS `user_id` int NULL AFTER `shift_id`;

UPDATE `transactions` `t`
INNER JOIN `orders` `o` ON `o`.`id` = `t`.`order_id`
SET
  `t`.`client_id` = COALESCE(`t`.`client_id`, `o`.`client_id`),
  `t`.`branch_id` = COALESCE(`t`.`branch_id`, `o`.`branch_id`),
  `t`.`shift_id` = COALESCE(`t`.`shift_id`, `o`.`shift_id`),
  `t`.`user_id` = COALESCE(`t`.`user_id`, `o`.`user_id`);
