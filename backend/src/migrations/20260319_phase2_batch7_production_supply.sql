ALTER TABLE `branches`
  ADD COLUMN `is_production_source` tinyint(1) NOT NULL DEFAULT 0 AFTER `inventory_store_type`,
  ADD COLUMN `production_source_label` varchar(100) DEFAULT NULL AFTER `is_production_source`;

ALTER TABLE `inventory_transfers`
  ADD COLUMN `flow_type` enum('stock_transfer','production_supply') NOT NULL DEFAULT 'stock_transfer' AFTER `notes`;

ALTER TABLE `inventory_transfer_items`
  ADD COLUMN `production_stage` enum('raw','semi_prepared','prepared') NOT NULL DEFAULT 'raw' AFTER `item_id`;

CREATE INDEX `IDX_inventory_transfers_client_flow_type`
  ON `inventory_transfers` (`client_id`, `flow_type`);

CREATE INDEX `IDX_inventory_transfers_client_flow_status`
  ON `inventory_transfers` (`client_id`, `flow_type`, `status`);
