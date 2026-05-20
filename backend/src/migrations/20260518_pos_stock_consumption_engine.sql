CREATE TABLE IF NOT EXISTS `inventory_consumptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `source_type` varchar(50) NOT NULL,
  `source_id` varchar(100) NOT NULL,
  `posted_by` varchar(120) NULL,
  `posted_at` datetime NOT NULL,
  `total_cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `metadata` json NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_inventory_consumptions_scope` (`client_id`, `branch_id`, `source_type`, `source_id`),
  KEY `IDX_inventory_consumptions_posted` (`client_id`, `branch_id`, `posted_at`)
);

CREATE TABLE IF NOT EXISTS `inventory_consumption_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `consumption_id` int NOT NULL,
  `item_id` int NOT NULL,
  `item_name` varchar(200) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `uom` varchar(50) NULL,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `total_cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `ledger_id` int NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_inventory_consumption_lines_consumption` (`consumption_id`),
  KEY `IDX_inventory_consumption_lines_item` (`item_id`),
  CONSTRAINT `FK_inventory_consumption_lines_header` FOREIGN KEY (`consumption_id`) REFERENCES `inventory_consumptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_inventory_consumption_lines_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `FK_inventory_consumption_lines_ledger` FOREIGN KEY (`ledger_id`) REFERENCES `inventory_stock_ledger` (`id`)
);

CREATE TABLE IF NOT EXISTS `inventory_waste` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `waste_date` datetime NOT NULL,
  `waste_type` varchar(50) NOT NULL,
  `reason` varchar(255) NULL,
  `approved_by` varchar(120) NULL,
  `total_cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_inventory_waste_scope` (`client_id`, `branch_id`, `waste_date`)
);

CREATE TABLE IF NOT EXISTS `inventory_waste_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `waste_id` int NOT NULL,
  `item_id` int NOT NULL,
  `item_name` varchar(200) NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `uom` varchar(50) NULL,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `ledger_id` int NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_inventory_waste_lines_waste` (`waste_id`),
  CONSTRAINT `FK_inventory_waste_lines_header` FOREIGN KEY (`waste_id`) REFERENCES `inventory_waste` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_inventory_waste_lines_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `FK_inventory_waste_lines_ledger` FOREIGN KEY (`ledger_id`) REFERENCES `inventory_stock_ledger` (`id`)
);

CREATE TABLE IF NOT EXISTS `order_modifiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_item_id` int NOT NULL,
  `modifier_name` varchar(120) NOT NULL,
  `ingredient_item_id` int NULL,
  `qty_impact` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `uom` varchar(50) NULL,
  `price_impact` decimal(12,2) NOT NULL DEFAULT 0.00,
  `behavior` enum('add','skip') NOT NULL DEFAULT 'add',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_order_modifiers_order_item` (`order_item_id`),
  CONSTRAINT `FK_order_modifiers_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_order_modifiers_ingredient` FOREIGN KEY (`ingredient_item_id`) REFERENCES `inventory_items` (`id`)
);

CREATE TABLE IF NOT EXISTS `pos_void_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `reason` varchar(255) NULL,
  `approved_by` varchar(150) NULL,
  `metadata` json NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_pos_void_logs_order` (`order_id`),
  CONSTRAINT `FK_pos_void_logs_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `pos_combos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `product_id` int NOT NULL,
  `combo_name` varchar(150) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_pos_combos_product` (`client_id`, `product_id`),
  CONSTRAINT `FK_pos_combos_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
);

CREATE TABLE IF NOT EXISTS `pos_combo_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `combo_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` decimal(10,3) NOT NULL DEFAULT 1.000,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_pos_combo_items_combo` (`combo_id`),
  CONSTRAINT `FK_pos_combo_items_combo` FOREIGN KEY (`combo_id`) REFERENCES `pos_combos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_pos_combo_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
);
