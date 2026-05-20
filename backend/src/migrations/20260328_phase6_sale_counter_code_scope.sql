SET @sale_counters_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'sale_counters'
);

SET @sale_counter_code_unique_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sale_counters'
    AND index_name = 'code'
    AND non_unique = 0
);

SET @drop_sale_counter_code_unique_sql := IF(
  @sale_counters_table_exists = 0,
  'SELECT 1',
  IF(
    @sale_counter_code_unique_exists > 0,
    'ALTER TABLE `sale_counters` DROP INDEX `code`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_sale_counter_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sale_counter_branch_code_unique_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sale_counters'
    AND index_name = 'IDX_sale_counters_client_branch_code'
    AND non_unique = 0
);

SET @create_sale_counter_branch_code_unique_sql := IF(
  @sale_counters_table_exists = 0,
  'SELECT 1',
  IF(
    @sale_counter_branch_code_unique_exists = 0,
    'ALTER TABLE `sale_counters` ADD UNIQUE KEY `IDX_sale_counters_client_branch_code` (`client_id`, `branch_id`, `code`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_sale_counter_branch_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
