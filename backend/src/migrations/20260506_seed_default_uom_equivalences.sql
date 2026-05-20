ALTER TABLE uoms
  MODIFY COLUMN abbreviation VARCHAR(30) NOT NULL;

INSERT INTO uoms (client_id, name, abbreviation, uom_type, description, is_base_unit, is_active, base_unit_id, conversion_factor, created_at, updated_at)
SELECT c.client_code, seed.name, seed.abbreviation, seed.uom_type, seed.description, seed.is_base_unit, 1, NULL, seed.conversion_factor, NOW(), NOW()
FROM clients c
JOIN (
  SELECT 'Gram' name, 'G' abbreviation, 'weight' uom_type, 'Base weight unit' description, 1 is_base_unit, 1 conversion_factor
  UNION ALL SELECT 'Milliliter', 'ML', 'volume', 'Base volume unit', 1, 1
  UNION ALL SELECT 'Piece', 'PCS', 'count', 'Base count unit', 1, 1
) seed
WHERE NOT EXISTS (
  SELECT 1 FROM uoms existing
  WHERE existing.client_id = c.client_code AND UPPER(existing.abbreviation) = seed.abbreviation
);

INSERT INTO uoms (client_id, name, abbreviation, uom_type, description, is_base_unit, is_active, base_unit_id, conversion_factor, created_at, updated_at)
SELECT c.client_code, seed.name, seed.abbreviation, seed.uom_type, seed.description, 0, 1,
  (SELECT base.id FROM uoms base WHERE base.client_id = c.client_code AND UPPER(base.abbreviation) = seed.base_code LIMIT 1),
  seed.conversion_factor, NOW(), NOW()
FROM clients c
JOIN (
  SELECT 'Kilogram' name, 'KG' abbreviation, 'weight' uom_type, '1 KG = 1000 G' description, 'G' base_code, 1000 conversion_factor
  UNION ALL SELECT 'Milligram', 'MG', 'weight', '1 MG = 0.001 G', 'G', 0.001
  UNION ALL SELECT 'Bag 5 KG', 'BAG_5KG', 'weight', '1 BAG_5KG = 5000 G', 'G', 5000
  UNION ALL SELECT 'Bag 10 KG', 'BAG_10KG', 'weight', '1 BAG_10KG = 10000 G', 'G', 10000
  UNION ALL SELECT 'Bag 20 KG', 'BAG_20KG', 'weight', '1 BAG_20KG = 20000 G', 'G', 20000
  UNION ALL SELECT 'Bag 25 KG', 'BAG_25KG', 'weight', '1 BAG_25KG = 25000 G', 'G', 25000
  UNION ALL SELECT 'Bag 40 KG', 'BAG_40KG', 'weight', '1 BAG_40KG = 40000 G', 'G', 40000
  UNION ALL SELECT 'Bag 50 KG', 'BAG_50KG', 'weight', '1 BAG_50KG = 50000 G', 'G', 50000
  UNION ALL SELECT 'Liter', 'L', 'volume', '1 L = 1000 ML', 'ML', 1000
  UNION ALL SELECT 'Bottle 250 ML', 'BOTTLE_250ML', 'volume', '1 BOTTLE_250ML = 250 ML', 'ML', 250
  UNION ALL SELECT 'Bottle 300 ML', 'BOTTLE_300ML', 'volume', '1 BOTTLE_300ML = 300 ML', 'ML', 300
  UNION ALL SELECT 'Bottle 500 ML', 'BOTTLE_500ML', 'volume', '1 BOTTLE_500ML = 500 ML', 'ML', 500
  UNION ALL SELECT 'Bottle 1 Liter', 'BOTTLE_1L', 'volume', '1 BOTTLE_1L = 1000 ML', 'ML', 1000
  UNION ALL SELECT 'Dozen', 'DOZEN', 'count', '1 DOZEN = 12 PCS', 'PCS', 12
  UNION ALL SELECT 'Pack 6 Pieces', 'PACK_6', 'count', '1 PACK_6 = 6 PCS', 'PCS', 6
  UNION ALL SELECT 'Pack 12 Pieces', 'PACK_12', 'count', '1 PACK_12 = 12 PCS', 'PCS', 12
  UNION ALL SELECT 'Pack 24 Pieces', 'PACK_24', 'count', '1 PACK_24 = 24 PCS', 'PCS', 24
  UNION ALL SELECT 'Crate 6 Bottles', 'CRATE_6', 'count', '1 CRATE_6 = 6 PCS', 'PCS', 6
  UNION ALL SELECT 'Crate 12 Bottles', 'CRATE_12', 'count', '1 CRATE_12 = 12 PCS', 'PCS', 12
  UNION ALL SELECT 'Crate 24 Bottles', 'CRATE_24', 'count', '1 CRATE_24 = 24 PCS', 'PCS', 24
) seed
WHERE NOT EXISTS (
  SELECT 1 FROM uoms existing
  WHERE existing.client_id = c.client_code AND UPPER(existing.abbreviation) = seed.abbreviation
);
