ALTER TABLE `inventory_items`
  ADD COLUMN IF NOT EXISTS `item_tag` varchar(50) NOT NULL DEFAULT 'Raw Material' AFTER `uom_purchase`;

UPDATE `inventory_items` item
JOIN `inventory_sub_types` sub_type
  ON sub_type.id = item.sub_type_id
JOIN `inventory_types` type
  ON type.id = sub_type.type_id
JOIN `inventory_classes` class
  ON class.id = type.class_id
SET item.item_tag = CASE
  WHEN UPPER(class.class_name) = 'PACKAGING' THEN 'Packaging'
  WHEN UPPER(class.class_name) IN ('FIXED ASSETS', 'CROCKERY & GLASSWARE', 'EVENT & CATERING') THEN 'Asset'
  WHEN UPPER(class.class_name) IN ('CLEANING SUPPLIES', 'OPERATING SUPPLIES') THEN 'MRO Supplies'
  WHEN UPPER(class.class_name) IN ('DISPOSABLES', 'KITCHEN CONSUMABLES') THEN 'Consumable'
  ELSE 'Raw Material'
END
WHERE item.item_tag IS NULL
  OR item.item_tag = ''
  OR item.item_tag = 'Raw Material';
