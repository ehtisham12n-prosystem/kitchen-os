ALTER TABLE `purchase_orders`
  ADD COLUMN `destination_branch_id` int NULL AFTER `branch_id`,
  ADD COLUMN `destination_store_label` varchar(100) NULL AFTER `notes`,
  ADD COLUMN `procurement_mode` enum('branch_direct','central_procurement','hybrid') NOT NULL DEFAULT 'branch_direct' AFTER `destination_store_label`,
  ADD COLUMN `approval_status` enum('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required' AFTER `procurement_mode`,
  ADD COLUMN `approved_by` varchar(100) NULL AFTER `approval_status`,
  ADD COLUMN `approved_by_name` varchar(150) NULL AFTER `approved_by`,
  ADD COLUMN `approved_at` datetime NULL AFTER `approved_by_name`,
  ADD COLUMN `approval_notes` text NULL AFTER `approved_at`,
  ADD COLUMN `procurement_request_id` int NULL AFTER `approval_notes`;

UPDATE `purchase_orders`
SET `destination_branch_id` = `branch_id`
WHERE `destination_branch_id` IS NULL;

ALTER TABLE `purchase_orders`
  ADD KEY `IDX_purchase_orders_client_destination_branch` (`client_id`, `destination_branch_id`),
  ADD KEY `IDX_purchase_orders_client_approval_status` (`client_id`, `approval_status`),
  ADD CONSTRAINT `FK_purchase_orders_destination_branch`
    FOREIGN KEY (`destination_branch_id`) REFERENCES `branches` (`id`);

CREATE TABLE `procurement_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `request_no` varchar(50) NOT NULL,
  `requesting_branch_id` int NOT NULL,
  `destination_branch_id` int NOT NULL,
  `preferred_vendor_id` int DEFAULT NULL,
  `procurement_mode` enum('branch_direct','central_procurement','hybrid') NOT NULL DEFAULT 'branch_direct',
  `priority` enum('routine','urgent','critical') NOT NULL DEFAULT 'routine',
  `notes` text DEFAULT NULL,
  `status` enum('pending','approved','rejected','converted') NOT NULL DEFAULT 'pending',
  `requested_by` varchar(100) DEFAULT NULL,
  `requested_by_name` varchar(150) DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` varchar(100) DEFAULT NULL,
  `reviewed_by_name` varchar(150) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `linked_po_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_procurement_requests_client_request_no` (`client_id`, `request_no`),
  KEY `IDX_procurement_requests_client_status` (`client_id`, `status`),
  KEY `IDX_procurement_requests_client_requesting_branch` (`client_id`, `requesting_branch_id`),
  KEY `IDX_procurement_requests_client_destination_branch` (`client_id`, `destination_branch_id`),
  CONSTRAINT `FK_procurement_requests_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_procurement_requests_requesting_branch` FOREIGN KEY (`requesting_branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_procurement_requests_destination_branch` FOREIGN KEY (`destination_branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_procurement_requests_preferred_vendor` FOREIGN KEY (`preferred_vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `FK_procurement_requests_linked_po` FOREIGN KEY (`linked_po_id`) REFERENCES `purchase_orders` (`id`)
);

CREATE TABLE `procurement_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `client_id` varchar(20) NOT NULL,
  `item_id` int NOT NULL,
  `requested_quantity` decimal(15,4) NOT NULL,
  `approved_quantity` decimal(15,4) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_procurement_request_items_request` (`request_id`),
  KEY `IDX_procurement_request_items_client_item` (`client_id`, `item_id`),
  CONSTRAINT `FK_procurement_request_items_request` FOREIGN KEY (`request_id`) REFERENCES `procurement_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_procurement_request_items_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_procurement_request_items_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`)
);
