SET @schema_name := DATABASE();

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'audit_logs'
      AND INDEX_NAME = 'IDX_audit_logs_timestamp_id'
  ) = 0,
  'ALTER TABLE `audit_logs` ADD INDEX `IDX_audit_logs_timestamp_id` (`timestamp`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'audit_logs'
      AND INDEX_NAME = 'IDX_audit_logs_client_timestamp'
  ) = 0,
  'ALTER TABLE `audit_logs` ADD INDEX `IDX_audit_logs_client_timestamp` (`client_id`, `timestamp`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'audit_logs'
      AND INDEX_NAME = 'IDX_audit_logs_client_branch_timestamp'
  ) = 0,
  'ALTER TABLE `audit_logs` ADD INDEX `IDX_audit_logs_client_branch_timestamp` (`client_id`, `branch_id`, `timestamp`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_stock_ledger'
      AND INDEX_NAME = 'IDX_inventory_stock_ledger_branch_created'
  ) = 0,
  'ALTER TABLE `inventory_stock_ledger` ADD INDEX `IDX_inventory_stock_ledger_branch_created` (`client_id`, `branch_id`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_stock_ledger'
      AND INDEX_NAME = 'IDX_inventory_stock_ledger_branch_type_created'
  ) = 0,
  'ALTER TABLE `inventory_stock_ledger` ADD INDEX `IDX_inventory_stock_ledger_branch_type_created` (`client_id`, `branch_id`, `transaction_type`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'inventory_stock_ledger'
      AND INDEX_NAME = 'IDX_inventory_stock_ledger_branch_item_created'
  ) = 0,
  'ALTER TABLE `inventory_stock_ledger` ADD INDEX `IDX_inventory_stock_ledger_branch_item_created` (`client_id`, `branch_id`, `item_id`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'goods_receipt_notes'
      AND INDEX_NAME = 'IDX_goods_receipt_notes_branch_receipt_date'
  ) = 0,
  'ALTER TABLE `goods_receipt_notes` ADD INDEX `IDX_goods_receipt_notes_branch_receipt_date` (`client_id`, `branch_id`, `receipt_date`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'goods_receipt_notes'
      AND INDEX_NAME = 'IDX_goods_receipt_notes_payable_status'
  ) = 0,
  'ALTER TABLE `goods_receipt_notes` ADD INDEX `IDX_goods_receipt_notes_payable_status` (`client_id`, `payable_status`, `receipt_date`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'goods_receipt_note_items'
      AND INDEX_NAME = 'IDX_grn_items_grn_item'
  ) = 0,
  'ALTER TABLE `goods_receipt_note_items` ADD INDEX `IDX_grn_items_grn_item` (`grn_id`, `item_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'goods_receipt_note_items'
      AND INDEX_NAME = 'IDX_grn_items_client_po_item'
  ) = 0,
  'ALTER TABLE `goods_receipt_note_items` ADD INDEX `IDX_grn_items_client_po_item` (`client_id`, `po_item_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'purchase_orders'
      AND INDEX_NAME = 'IDX_purchase_orders_client_branch_created'
  ) = 0,
  'ALTER TABLE `purchase_orders` ADD INDEX `IDX_purchase_orders_client_branch_created` (`client_id`, `branch_id`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'purchase_orders'
      AND INDEX_NAME = 'IDX_purchase_orders_client_destination_created'
  ) = 0,
  'ALTER TABLE `purchase_orders` ADD INDEX `IDX_purchase_orders_client_destination_created` (`client_id`, `destination_branch_id`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'purchase_orders'
      AND INDEX_NAME = 'IDX_purchase_orders_client_workflow'
  ) = 0,
  'ALTER TABLE `purchase_orders` ADD INDEX `IDX_purchase_orders_client_workflow` (`client_id`, `approval_status`, `status`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'purchase_order_items'
      AND INDEX_NAME = 'IDX_purchase_order_items_po_item'
  ) = 0,
  'ALTER TABLE `purchase_order_items` ADD INDEX `IDX_purchase_order_items_po_item` (`po_id`, `item_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
