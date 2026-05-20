ALTER TABLE `branch_product_mapping`
  ADD COLUMN `menu_type_id` int NULL AFTER `price_override`,
  ADD INDEX `IDX_branch_product_mapping_branch_menu_type` (`branch_id`, `menu_type_id`);
