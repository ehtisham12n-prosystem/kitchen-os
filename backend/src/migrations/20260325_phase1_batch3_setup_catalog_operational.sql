CREATE TABLE `tax_configurations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `tax_name` varchar(100) NOT NULL,
  `tax_code` varchar(50) NOT NULL,
  `calculation_method` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
  `tax_rate` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `description` text NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `applies_to_dine_in` tinyint(1) NOT NULL DEFAULT 1,
  `applies_to_takeout` tinyint(1) NOT NULL DEFAULT 1,
  `applies_to_delivery` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_tax_configurations_client_code` (`client_id`, `tax_code`),
  KEY `IDX_tax_configurations_client_is_active` (`client_id`, `is_active`)
);

ALTER TABLE `roles`
  ADD COLUMN `description` text NULL AFTER `role_name`;

ALTER TABLE `products`
  ADD COLUMN `tax_configuration_id` int NULL AFTER `base_uom_id`,
  ADD KEY `IDX_products_client_tax_configuration` (`client_id`, `tax_configuration_id`);

ALTER TABLE `branch_product_mapping`
  ADD COLUMN `channel_availability` json NULL AFTER `menu_type_id`;

ALTER TABLE `recipes`
  ADD COLUMN `description` text NULL AFTER `yield_uom`,
  ADD COLUMN `preparation_method` text NULL AFTER `description`,
  ADD COLUMN `serves_people` int NULL AFTER `preparation_method`,
  ADD COLUMN `image_url` text NULL AFTER `serves_people`,
  ADD COLUMN `prepared_by` varchar(150) NULL AFTER `image_url`;
