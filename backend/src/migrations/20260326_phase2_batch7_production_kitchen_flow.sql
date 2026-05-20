ALTER TABLE `production_orders`
  MODIFY COLUMN `planned_quantity` decimal(15,4) NOT NULL,
  MODIFY COLUMN `actual_quantity` decimal(15,4) NULL,
  ADD COLUMN `recipe_id` int NULL AFTER `product_id`,
  ADD COLUMN `output_stage` enum('semi_prepared','prepared') NOT NULL DEFAULT 'prepared' AFTER `prepared_item_id`,
  ADD COLUMN `issued_by` varchar(100) NULL AFTER `queued_at`,
  ADD COLUMN `issued_by_name` varchar(150) NULL AFTER `issued_by`,
  ADD COLUMN `materials_issued_at` datetime NULL AFTER `issued_by_name`,
  ADD COLUMN `issue_notes` text NULL AFTER `materials_issued_at`;

CREATE TABLE `production_order_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `production_order_id` int NOT NULL,
  `recipe_ingredient_id` int NULL,
  `item_id` int NOT NULL,
  `uom` varchar(50) NOT NULL,
  `wastage_percentage` decimal(5,2) NOT NULL DEFAULT 0,
  `planned_quantity` decimal(15,4) NOT NULL DEFAULT 0,
  `issued_quantity` decimal(15,4) NOT NULL DEFAULT 0,
  `unit_cost` decimal(15,4) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `IDX_production_order_materials_client_order` (`client_id`, `production_order_id`),
  INDEX `IDX_production_order_materials_client_item` (`client_id`, `item_id`),
  CONSTRAINT `FK_production_order_materials_order`
    FOREIGN KEY (`production_order_id`) REFERENCES `production_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `FK_production_order_materials_item`
    FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_production_order_materials_recipe_ingredient`
    FOREIGN KEY (`recipe_ingredient_id`) REFERENCES `recipe_ingredients`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

ALTER TABLE `production_orders`
  ADD INDEX `IDX_production_orders_client_recipe` (`client_id`, `recipe_id`),
  ADD CONSTRAINT `FK_production_orders_recipe`
    FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
