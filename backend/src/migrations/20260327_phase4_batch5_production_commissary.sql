ALTER TABLE `production_orders`
  ADD COLUMN `production_no` varchar(50) NULL AFTER `branch_id`,
  ADD COLUMN `production_date` date NULL AFTER `actual_quantity`,
  ADD COLUMN `required_at` datetime NULL AFTER `production_date`,
  ADD COLUMN `planned_batch_count` int NOT NULL DEFAULT 1 AFTER `required_at`,
  ADD COLUMN `actual_batch_count` int NULL AFTER `planned_batch_count`,
  ADD COLUMN `wastage_quantity` decimal(15,4) NULL AFTER `actual_batch_count`,
  ADD COLUMN `yield_percentage` decimal(7,2) NULL AFTER `wastage_quantity`;

UPDATE `production_orders`
SET `production_no` = CONCAT('PROD-', LPAD(`id`, 6, '0'))
WHERE `production_no` IS NULL;

UPDATE `production_orders`
SET `production_date` = DATE(COALESCE(`requested_at`, `created_at`))
WHERE `production_date` IS NULL;

ALTER TABLE `production_orders`
  MODIFY COLUMN `production_no` varchar(50) NOT NULL,
  ADD UNIQUE KEY `UQ_production_orders_client_production_no` (`client_id`, `production_no`);

CREATE TABLE `production_order_batches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `production_order_id` int NOT NULL,
  `batch_no` varchar(50) NOT NULL,
  `batch_sequence` int NOT NULL,
  `planned_quantity` decimal(15,4) NOT NULL DEFAULT 0,
  `actual_quantity` decimal(15,4) NOT NULL DEFAULT 0,
  `wastage_quantity` decimal(15,4) NOT NULL DEFAULT 0,
  `yield_percentage` decimal(7,2) NULL,
  `status` enum('planned','completed') NOT NULL DEFAULT 'completed',
  `notes` text NULL,
  `completed_at` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_production_order_batches_client_batch_no` (`client_id`, `batch_no`),
  KEY `IDX_production_order_batches_client_order` (`client_id`, `production_order_id`),
  CONSTRAINT `FK_production_order_batches_client`
    FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
  CONSTRAINT `FK_production_order_batches_order`
    FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE CASCADE
);

INSERT INTO `production_order_batches` (
  `client_id`,
  `production_order_id`,
  `batch_no`,
  `batch_sequence`,
  `planned_quantity`,
  `actual_quantity`,
  `wastage_quantity`,
  `yield_percentage`,
  `status`,
  `notes`,
  `completed_at`,
  `created_at`,
  `updated_at`
)
SELECT
  `client_id`,
  `id`,
  CONCAT(`production_no`, '-B01'),
  1,
  `planned_quantity`,
  COALESCE(`actual_quantity`, 0),
  0,
  CASE
    WHEN COALESCE(`planned_quantity`, 0) > 0 AND COALESCE(`actual_quantity`, 0) > 0
      THEN ROUND((`actual_quantity` / `planned_quantity`) * 100, 2)
    ELSE NULL
  END,
  CASE
    WHEN `actual_quantity` IS NOT NULL AND `actual_quantity` > 0 THEN 'completed'
    ELSE 'planned'
  END,
  `completion_notes`,
  `completion_date`,
  `created_at`,
  `updated_at`
FROM `production_orders`;

UPDATE `production_orders`
SET
  `actual_batch_count` = CASE
    WHEN COALESCE(`actual_quantity`, 0) > 0 THEN 1
    ELSE NULL
  END,
  `yield_percentage` = CASE
    WHEN COALESCE(`planned_quantity`, 0) > 0 AND COALESCE(`actual_quantity`, 0) > 0
      THEN ROUND((`actual_quantity` / `planned_quantity`) * 100, 2)
    ELSE NULL
  END;

ALTER TABLE `inventory_transfers`
  ADD COLUMN `origin_production_order_id` int NULL AFTER `reason_code`,
  ADD COLUMN `origin_production_no` varchar(50) NULL AFTER `origin_production_order_id`,
  ADD KEY `IDX_inventory_transfers_client_origin_production` (`client_id`, `origin_production_order_id`),
  ADD CONSTRAINT `FK_inventory_transfers_origin_production_order`
    FOREIGN KEY (`origin_production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
