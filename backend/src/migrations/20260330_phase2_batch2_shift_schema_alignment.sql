ALTER TABLE `shifts`
  ADD COLUMN IF NOT EXISTS `external_shift_id` varchar(100) NULL AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `source_device_id` int NULL AFTER `external_shift_id`,
  ADD COLUMN IF NOT EXISTS `source_device_uid` varchar(100) NULL AFTER `source_device_id`,
  ADD COLUMN IF NOT EXISTS `sync_origin` enum('online','offline') NOT NULL DEFAULT 'online' AFTER `source_device_uid`;

SET @shift_external_idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'shifts'
    AND index_name = 'idx_shifts_client_branch_external_shift'
);

SET @shift_external_idx_sql := IF(
  @shift_external_idx_exists = 0,
  'ALTER TABLE `shifts` ADD KEY `idx_shifts_client_branch_external_shift` (`client_id`, `branch_id`, `external_shift_id`)',
  'SELECT 1'
);

PREPARE stmt FROM @shift_external_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
