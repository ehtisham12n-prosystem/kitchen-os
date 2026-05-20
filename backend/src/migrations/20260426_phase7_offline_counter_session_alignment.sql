ALTER TABLE `authorized_tills`
  ADD COLUMN IF NOT EXISTS `external_session_id` varchar(100) NULL AFTER `sale_counter_id`,
  ADD COLUMN IF NOT EXISTS `source_device_id` int NULL AFTER `external_session_id`,
  ADD COLUMN IF NOT EXISTS `source_device_uid` varchar(100) NULL AFTER `source_device_id`,
  ADD COLUMN IF NOT EXISTS `sync_origin` enum('online','offline') NOT NULL DEFAULT 'online' AFTER `source_device_uid`;

SET @has_authorized_tills_external_idx := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'authorized_tills'
    AND index_name = 'IDX_authorized_tills_external_session'
);
SET @sql := IF(
  @has_authorized_tills_external_idx = 0,
  'ALTER TABLE `authorized_tills` ADD UNIQUE KEY `IDX_authorized_tills_external_session` (`client_id`, `branch_id`, `external_session_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
