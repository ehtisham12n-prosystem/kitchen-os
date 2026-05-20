CREATE TABLE IF NOT EXISTS order_returns (
  id int NOT NULL AUTO_INCREMENT,
  order_id int NOT NULL,
  client_id varchar(20) NOT NULL,
  branch_id int NOT NULL,
  processed_by_user_id int DEFAULT NULL,
  return_scope enum('full','partial') NOT NULL DEFAULT 'partial',
  refund_amount decimal(12,2) NOT NULL DEFAULT 0.00,
  restock_inventory tinyint(1) NOT NULL DEFAULT 1,
  return_note text DEFAULT NULL,
  payment_note varchar(255) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_order_returns_order (order_id),
  KEY IDX_order_returns_client_branch (client_id, branch_id),
  CONSTRAINT FK_order_returns_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT FK_order_returns_client FOREIGN KEY (client_id) REFERENCES clients (id),
  CONSTRAINT FK_order_returns_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
);

CREATE TABLE IF NOT EXISTS order_return_items (
  id int NOT NULL AUTO_INCREMENT,
  return_id int NOT NULL,
  order_item_id int NOT NULL,
  product_id int NOT NULL,
  product_name varchar(150) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL DEFAULT 0.00,
  base_amount decimal(12,2) NOT NULL DEFAULT 0.00,
  discount_amount decimal(12,2) NOT NULL DEFAULT 0.00,
  tax_amount decimal(12,2) NOT NULL DEFAULT 0.00,
  service_charge_amount decimal(12,2) NOT NULL DEFAULT 0.00,
  refund_amount decimal(12,2) NOT NULL DEFAULT 0.00,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_order_return_items_return (return_id),
  KEY IDX_order_return_items_order_item (order_item_id),
  CONSTRAINT FK_order_return_items_return FOREIGN KEY (return_id) REFERENCES order_returns (id) ON DELETE CASCADE,
  CONSTRAINT FK_order_return_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id),
  CONSTRAINT FK_order_return_items_product FOREIGN KEY (product_id) REFERENCES products (id)
);

SET @transactions_return_id_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'transactions'
    AND column_name = 'return_id'
);
SET @transactions_return_id_sql := IF(
  @transactions_return_id_exists = 0,
  'ALTER TABLE transactions ADD COLUMN return_id int NULL AFTER order_id',
  'SELECT 1'
);
PREPARE stmt FROM @transactions_return_id_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @transactions_return_idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'transactions'
    AND index_name = 'IDX_transactions_return'
);
SET @transactions_return_idx_sql := IF(
  @transactions_return_idx_exists = 0,
  'ALTER TABLE transactions ADD KEY IDX_transactions_return (return_id)',
  'SELECT 1'
);
PREPARE stmt FROM @transactions_return_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @transactions_return_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND constraint_name = 'FK_transactions_return'
);
SET @transactions_return_fk_sql := IF(
  @transactions_return_fk_exists = 0,
  'ALTER TABLE transactions ADD CONSTRAINT FK_transactions_return FOREIGN KEY (return_id) REFERENCES order_returns (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @transactions_return_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
