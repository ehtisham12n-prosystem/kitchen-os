ALTER TABLE `inventory_items`
  ADD COLUMN IF NOT EXISTS `item_name_other_language` varchar(150) NULL AFTER `item_name`;
