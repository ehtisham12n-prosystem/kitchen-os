ALTER TABLE `pos_devices`
  ADD COLUMN IF NOT EXISTS `last_sync_at` datetime NULL AFTER `last_seen_at`,
  ADD COLUMN IF NOT EXISTS `last_sync_status` enum('idle','success','failed','conflict') NOT NULL DEFAULT 'idle' AFTER `last_sync_at`,
  ADD COLUMN IF NOT EXISTS `last_sync_message` text NULL AFTER `last_sync_status`;

ALTER TABLE `pos_sync_events`
  ADD COLUMN IF NOT EXISTS `device_event_id` varchar(100) NULL AFTER `device_id`,
  ADD COLUMN IF NOT EXISTS `payload_json` longtext NULL AFTER `status`,
  MODIFY COLUMN `status` enum('pending','processed','failed','conflict') NOT NULL DEFAULT 'pending';

SET @has_pos_sync_event_device_key := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pos_sync_events'
    AND index_name = 'uq_pos_sync_events_device_event'
);
SET @sql := IF(
  @has_pos_sync_event_device_key = 0,
  'ALTER TABLE `pos_sync_events` ADD UNIQUE KEY `uq_pos_sync_events_device_event` (`device_id`, `device_event_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `shifts`
  ADD COLUMN IF NOT EXISTS `external_shift_id` varchar(100) NULL AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `source_device_id` int NULL AFTER `external_shift_id`,
  ADD COLUMN IF NOT EXISTS `source_device_uid` varchar(100) NULL AFTER `source_device_id`,
  ADD COLUMN IF NOT EXISTS `sync_origin` enum('online','offline') NOT NULL DEFAULT 'online' AFTER `source_device_uid`;

SET @has_shift_external_idx := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'shifts'
    AND index_name = 'idx_shifts_client_branch_external_shift'
);
SET @sql := IF(
  @has_shift_external_idx = 0,
  'ALTER TABLE `shifts` ADD KEY `idx_shifts_client_branch_external_shift` (`client_id`, `branch_id`, `external_shift_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `source_device_id` int NULL AFTER `finalized_by_user_id`,
  ADD COLUMN IF NOT EXISTS `source_device_uid` varchar(100) NULL AFTER `source_device_id`,
  ADD COLUMN IF NOT EXISTS `sync_origin` enum('online','offline') NOT NULL DEFAULT 'online' AFTER `source_device_uid`,
  ADD COLUMN IF NOT EXISTS `offline_created_at` datetime NULL AFTER `sync_origin`;

SET @has_orders_sync_origin_idx := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_client_branch_sync_origin'
);
SET @sql := IF(
  @has_orders_sync_origin_idx = 0,
  'ALTER TABLE `orders` ADD KEY `idx_orders_client_branch_sync_origin` (`client_id`, `branch_id`, `sync_origin`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
