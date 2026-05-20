SET @authorized_till_unique_idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'authorized_tills'
    AND index_name = 'IDX_authorized_tills_unique'
);

SET @authorized_till_drop_unique_sql := IF(
  @authorized_till_unique_idx_exists > 0,
  'ALTER TABLE `authorized_tills` DROP INDEX `IDX_authorized_tills_unique`',
  'SELECT 1'
);

PREPARE stmt FROM @authorized_till_drop_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @authorized_till_composite_idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'authorized_tills'
    AND index_name = 'IDX_authorized_tills_shift_counter'
);

SET @authorized_till_add_idx_sql := IF(
  @authorized_till_composite_idx_exists = 0,
  'ALTER TABLE `authorized_tills` ADD INDEX `IDX_authorized_tills_shift_counter` (`client_id`, `branch_id`, `shift_id`, `sale_counter_id`)',
  'SELECT 1'
);

PREPARE stmt FROM @authorized_till_add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
