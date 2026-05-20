CREATE TABLE `goods_receipt_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `purchase_order_id` int DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `grn_number` varchar(50) NOT NULL,
  `receipt_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('posted','voided') NOT NULL DEFAULT 'posted',
  `vendor_invoice_number` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `received_by` varchar(100) DEFAULT NULL,
  `received_by_name` varchar(150) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_goods_receipt_notes_client_grn_number` (`client_id`, `grn_number`),
  KEY `IDX_goods_receipt_notes_client_branch` (`client_id`, `branch_id`),
  KEY `IDX_goods_receipt_notes_client_po` (`client_id`, `purchase_order_id`),
  CONSTRAINT `FK_goods_receipt_notes_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_goods_receipt_notes_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_goods_receipt_notes_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `FK_goods_receipt_notes_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
);

CREATE TABLE `goods_receipt_note_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_id` int NOT NULL,
  `client_id` varchar(20) NOT NULL,
  `po_item_id` int DEFAULT NULL,
  `item_id` int NOT NULL,
  `ordered_quantity` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `received_quantity` decimal(15,4) NOT NULL,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `line_total` decimal(15,4) NOT NULL DEFAULT 0.0000,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_goods_receipt_note_items_grn` (`grn_id`),
  KEY `IDX_goods_receipt_note_items_client_item` (`client_id`, `item_id`),
  KEY `IDX_goods_receipt_note_items_po_item` (`po_item_id`),
  CONSTRAINT `FK_goods_receipt_note_items_grn` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_goods_receipt_note_items_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_goods_receipt_note_items_po_item` FOREIGN KEY (`po_item_id`) REFERENCES `purchase_order_items` (`id`),
  CONSTRAINT `FK_goods_receipt_note_items_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`)
);

ALTER TABLE `inventory_stock_levels`
  ADD COLUMN `last_unit_cost` decimal(15,4) NOT NULL DEFAULT 0.0000 AFTER `current_quantity`,
  ADD COLUMN `last_received_at` datetime DEFAULT NULL AFTER `last_unit_cost`;

UPDATE `inventory_stock_levels` level
LEFT JOIN (
  SELECT
    `client_id`,
    `branch_id`,
    `item_id`,
    MAX(`created_at`) AS `last_received_at`,
    SUBSTRING_INDEX(GROUP_CONCAT(`unit_cost` ORDER BY `created_at` DESC), ',', 1) AS `last_unit_cost`
  FROM `inventory_stock_ledger`
  WHERE `unit_cost` > 0
  GROUP BY `client_id`, `branch_id`, `item_id`
) ledger
  ON ledger.`client_id` = level.`client_id`
 AND ledger.`branch_id` = level.`branch_id`
 AND ledger.`item_id` = level.`item_id`
SET
  level.`last_unit_cost` = COALESCE(ledger.`last_unit_cost`, 0),
  level.`last_received_at` = ledger.`last_received_at`;
