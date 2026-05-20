ALTER TABLE `branch_product_mapping`
  ADD COLUMN `temporarily_disabled_until` datetime NULL AFTER `channel_availability`,
  ADD COLUMN `temporary_disable_reason` varchar(255) NULL AFTER `temporarily_disabled_until`,
  ADD KEY `IDX_branch_product_mapping_temp_disable` (`branch_id`, `temporarily_disabled_until`);
