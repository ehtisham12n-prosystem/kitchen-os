CREATE TABLE IF NOT EXISTS `goods_receipt_returns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `grn_id` int NOT NULL,
  `vendor_id` int NULL,
  `return_number` varchar(50) NOT NULL,
  `return_date` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'posted',
  `debit_note_reference` varchar(100) NULL,
  `notes` text NULL,
  `returned_by` varchar(100) NULL,
  `returned_by_name` varchar(150) NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_goods_receipt_returns_client_return_number` (`client_id`, `return_number`),
  KEY `IDX_goods_receipt_returns_client_branch` (`client_id`, `branch_id`),
  KEY `IDX_goods_receipt_returns_client_grn` (`client_id`, `grn_id`)
);

CREATE TABLE IF NOT EXISTS `goods_receipt_return_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `return_id` int NOT NULL,
  `client_id` varchar(20) NOT NULL,
  `grn_item_id` int NOT NULL,
  `item_id` int NOT NULL,
  `returned_quantity` decimal(15,4) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT 0,
  `line_total` decimal(15,4) NOT NULL DEFAULT 0,
  `notes` text NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_goods_receipt_return_items_return` (`return_id`),
  KEY `IDX_goods_receipt_return_items_client_grn_item` (`client_id`, `grn_item_id`)
);
