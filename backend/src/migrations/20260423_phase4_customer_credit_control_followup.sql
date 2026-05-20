ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `credit_control_mode` enum('warn','block') NOT NULL DEFAULT 'block' AFTER `credit_limit`,
  ADD COLUMN IF NOT EXISTS `collection_follow_up_date` date NULL AFTER `credit_control_mode`,
  ADD COLUMN IF NOT EXISTS `collection_follow_up_note` varchar(500) NULL AFTER `collection_follow_up_date`;
