ALTER TABLE `branch_product_mapping`
  DROP INDEX `IDX_9c528de28e8593e5bd15f06873`,
  ADD UNIQUE KEY `IDX_branch_product_mapping_branch_product_menu_type` (`branch_id`, `product_id`, `menu_type_id`);
