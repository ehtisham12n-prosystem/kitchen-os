ALTER TABLE `production_orders`
  MODIFY COLUMN `product_id` int NULL,
  MODIFY COLUMN `status` enum(
    'requested',
    'queued',
    'in_preparation',
    'prepared',
    'dispatched',
    'received',
    'rejected',
    'cancelled'
  ) NOT NULL DEFAULT 'requested',
  ADD COLUMN `destination_branch_id` int NULL AFTER `branch_id`,
  ADD COLUMN `prepared_item_id` int NULL AFTER `product_id`,
  ADD COLUMN `requested_by` varchar(100) NULL AFTER `status`,
  ADD COLUMN `requested_by_name` varchar(150) NULL AFTER `requested_by`,
  ADD COLUMN `requested_at` datetime NULL AFTER `requested_by_name`,
  ADD COLUMN `queued_by` varchar(100) NULL AFTER `requested_at`,
  ADD COLUMN `queued_by_name` varchar(150) NULL AFTER `queued_by`,
  ADD COLUMN `queued_at` datetime NULL AFTER `queued_by_name`,
  ADD COLUMN `queue_notes` text NULL AFTER `queued_at`,
  ADD COLUMN `completed_by` varchar(100) NULL AFTER `completion_date`,
  ADD COLUMN `completed_by_name` varchar(150) NULL AFTER `completed_by`,
  ADD COLUMN `completion_notes` text NULL AFTER `completed_by_name`,
  ADD COLUMN `linked_transfer_id` int NULL AFTER `completion_notes`,
  ADD COLUMN `dispatch_notes` text NULL AFTER `linked_transfer_id`,
  ADD COLUMN `receipt_notes` text NULL AFTER `dispatch_notes`,
  ADD COLUMN `variance_notes` text NULL AFTER `receipt_notes`,
  ADD COLUMN `rejection_notes` text NULL AFTER `variance_notes`,
  ADD COLUMN `cancellation_notes` text NULL AFTER `rejection_notes`,
  ADD COLUMN `source_unit_label` varchar(100) NULL AFTER `cancellation_notes`,
  ADD COLUMN `destination_unit_label` varchar(100) NULL AFTER `source_unit_label`;

UPDATE `production_orders`
SET `destination_branch_id` = `branch_id`
WHERE `destination_branch_id` IS NULL;

UPDATE `production_orders`
SET `requested_at` = COALESCE(`requested_at`, `created_at`)
WHERE `requested_at` IS NULL;

UPDATE `production_orders`
SET `status` = CASE `status`
  WHEN 'planned' THEN 'requested'
  WHEN 'in_progress' THEN 'in_preparation'
  WHEN 'completed' THEN 'prepared'
  WHEN 'cancelled' THEN 'cancelled'
  ELSE `status`
END;

ALTER TABLE `production_orders`
  ADD INDEX `IDX_production_orders_client_destination_branch` (`client_id`, `destination_branch_id`),
  ADD CONSTRAINT `FK_production_orders_destination_branch`
    FOREIGN KEY (`destination_branch_id`) REFERENCES `branches`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `FK_production_orders_prepared_item`
    FOREIGN KEY (`prepared_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `FK_production_orders_linked_transfer`
    FOREIGN KEY (`linked_transfer_id`) REFERENCES `inventory_transfers`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
