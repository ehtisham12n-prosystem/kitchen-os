ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(200) NULL AFTER product_id;

UPDATE order_items oi
LEFT JOIN products p ON p.id = oi.product_id
SET oi.product_name = COALESCE(NULLIF(TRIM(oi.product_name), ''), p.product_name, CONCAT('Product #', oi.product_id))
WHERE oi.product_name IS NULL OR TRIM(oi.product_name) = '';
