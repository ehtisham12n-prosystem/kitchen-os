INSERT INTO uoms (client_id, name, abbreviation, uom_type, description, is_base_unit, is_active, base_unit_id, conversion_factor, created_at, updated_at)
SELECT c.client_code, seed.name, seed.abbreviation, 'count', seed.description, 1, 1, NULL, 1, NOW(), NOW()
FROM clients c
JOIN (
  SELECT 'Bottle' name, 'BOTTLE' abbreviation, 'Base bottle unit for beverage and bottled goods' description
  UNION ALL SELECT 'Can', 'CAN', 'Base can unit for canned goods'
  UNION ALL SELECT 'PET Bottle', 'PET', 'Base PET bottle unit'
  UNION ALL SELECT 'Packet', 'PACKET', 'Base packet or sachet unit'
  UNION ALL SELECT 'Box', 'BOX', 'Base box unit'
  UNION ALL SELECT 'Tray', 'TRAY', 'Base tray unit'
  UNION ALL SELECT 'Carton', 'CARTON', 'Base carton unit'
  UNION ALL SELECT 'Roll', 'ROLL', 'Base roll unit'
  UNION ALL SELECT 'Portion', 'PORTION', 'Base portion unit'
  UNION ALL SELECT 'Serving', 'SERVING', 'Base serving unit'
) seed
WHERE NOT EXISTS (
  SELECT 1 FROM uoms existing
  WHERE existing.client_id = c.client_code AND UPPER(existing.abbreviation) = seed.abbreviation
);
