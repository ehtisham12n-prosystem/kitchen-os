ALTER TABLE `accounting_fixed_asset_items`
  ADD COLUMN IF NOT EXISTS `inventory_item_id` int NULL AFTER `name`,
  ADD KEY `IDX_accounting_fixed_asset_items_inventory_item` (`inventory_item_id`);

ALTER TABLE `accounting_fixed_asset_units`
  ADD COLUMN IF NOT EXISTS `manufacturer` varchar(150) NULL AFTER `model`,
  ADD COLUMN IF NOT EXISTS `annual_depreciation_rate` decimal(7,2) NULL AFTER `purchase_price`;

