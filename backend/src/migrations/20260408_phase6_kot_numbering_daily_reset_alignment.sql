SET @orders_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
);

SET @orders_kot_base_unique_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'UQ_orders_kot_base_number'
    AND non_unique = 0
);

SET @drop_orders_kot_base_unique_sql := IF(
  @orders_table_exists = 0,
  'SELECT 1',
  IF(
    @orders_kot_base_unique_exists > 0,
    'ALTER TABLE `orders` DROP INDEX `UQ_orders_kot_base_number`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_orders_kot_base_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @orders_kot_base_lookup_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'IDX_orders_client_branch_kot_base_number'
);

SET @create_orders_kot_base_lookup_sql := IF(
  @orders_table_exists = 0,
  'SELECT 1',
  IF(
    @orders_kot_base_lookup_exists = 0,
    'ALTER TABLE `orders` ADD INDEX `IDX_orders_client_branch_kot_base_number` (`client_id`, `branch_id`, `kot_base_number`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @create_orders_kot_base_lookup_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS `pos_kot_sequences`;
