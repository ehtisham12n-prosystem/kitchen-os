ALTER TABLE `pos_sync_events`
  ADD COLUMN IF NOT EXISTS `batch_id` varchar(100) NULL AFTER `payload_hash`,
  ADD COLUMN IF NOT EXISTS `conflict_reason` varchar(100) NULL AFTER `error_message`,
  ADD COLUMN IF NOT EXISTS `resolution_status` enum('open','acknowledged','resolved') NULL AFTER `conflict_reason`,
  ADD COLUMN IF NOT EXISTS `resolution_note` text NULL AFTER `resolution_status`,
  ADD COLUMN IF NOT EXISTS `occurred_at` datetime NULL AFTER `resolution_note`,
  ADD COLUMN IF NOT EXISTS `resolved_at` datetime NULL AFTER `processed_at`,
  ADD COLUMN IF NOT EXISTS `resolved_by_user_id` int NULL AFTER `resolved_at`;

SET @has_pos_sync_events_resolution_idx := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pos_sync_events'
    AND index_name = 'idx_pos_sync_events_resolution'
);
SET @sql := IF(
  @has_pos_sync_events_resolution_idx = 0,
  'ALTER TABLE `pos_sync_events` ADD KEY `idx_pos_sync_events_resolution` (`branch_id`, `status`, `resolution_status`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_pos_devices_branch_code_idx := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pos_devices'
    AND index_name = 'idx_pos_devices_branch_code'
);
SET @sql := IF(
  @has_pos_devices_branch_code_idx = 0,
  'ALTER TABLE `pos_devices` ADD KEY `idx_pos_devices_branch_code` (`client_id`, `branch_id`, `device_code`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
