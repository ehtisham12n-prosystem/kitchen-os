SET @purchase_orders_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'purchase_orders'
);

SET @purchase_order_items_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'purchase_order_items'
);

SET @purchase_orders_has_po_status := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'purchase_orders'
    AND column_name = 'po_status'
);

SET @purchase_orders_has_total_cost := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'purchase_orders'
    AND column_name = 'total_cost'
);

SET @purchase_orders_has_expected_date := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'purchase_orders'
    AND column_name = 'expected_date'
);

SET @purchase_order_items_has_total_price := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'purchase_order_items'
    AND column_name = 'total_price'
);

SET @add_purchase_orders_po_status_sql := IF(
  @purchase_orders_table_exists = 0,
  'SELECT 1',
  IF(
    @purchase_orders_has_po_status = 0,
    'ALTER TABLE `purchase_orders` ADD COLUMN `po_status` enum(''draft'',''ordered'',''received'',''cancelled'') NULL AFTER `procurement_request_id`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_purchase_orders_po_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_purchase_orders_total_cost_sql := IF(
  @purchase_orders_table_exists = 0,
  'SELECT 1',
  IF(
    @purchase_orders_has_total_cost = 0,
    'ALTER TABLE `purchase_orders` ADD COLUMN `total_cost` decimal(15,2) NULL AFTER `po_status`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_purchase_orders_total_cost_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_purchase_orders_expected_date_sql := IF(
  @purchase_orders_table_exists = 0,
  'SELECT 1',
  IF(
    @purchase_orders_has_expected_date = 0,
    'ALTER TABLE `purchase_orders` ADD COLUMN `expected_date` date NULL AFTER `total_cost`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_purchase_orders_expected_date_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_purchase_order_items_total_price_sql := IF(
  @purchase_order_items_table_exists = 0,
  'SELECT 1',
  IF(
    @purchase_order_items_has_total_price = 0,
    'ALTER TABLE `purchase_order_items` ADD COLUMN `total_price` decimal(12,2) NULL AFTER `line_total`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_purchase_order_items_total_price_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @backfill_purchase_orders_po_status_sql := IF(
  @purchase_orders_table_exists = 0,
  'SELECT 1',
  'UPDATE `purchase_orders` SET `po_status` = CASE `status` WHEN ''sent'' THEN ''ordered'' ELSE `status` END WHERE (`po_status` IS NULL OR `po_status` = '''') AND `status` IS NOT NULL'
);
PREPARE stmt FROM @backfill_purchase_orders_po_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @backfill_purchase_orders_total_cost_sql := IF(
  @purchase_orders_table_exists = 0,
  'SELECT 1',
  'UPDATE `purchase_orders` SET `total_cost` = `total_amount` WHERE (`total_cost` IS NULL OR `total_cost` = 0) AND `total_amount` IS NOT NULL'
);
PREPARE stmt FROM @backfill_purchase_orders_total_cost_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @backfill_purchase_orders_expected_date_sql := IF(
  @purchase_orders_table_exists = 0,
  'SELECT 1',
  'UPDATE `purchase_orders` SET `expected_date` = `expected_delivery_date` WHERE `expected_date` IS NULL AND `expected_delivery_date` IS NOT NULL'
);
PREPARE stmt FROM @backfill_purchase_orders_expected_date_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @backfill_purchase_order_items_total_price_sql := IF(
  @purchase_order_items_table_exists = 0,
  'SELECT 1',
  'UPDATE `purchase_order_items` SET `total_price` = `line_total` WHERE (`total_price` IS NULL OR `total_price` = 0) AND `line_total` IS NOT NULL'
);
PREPARE stmt FROM @backfill_purchase_order_items_total_price_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
