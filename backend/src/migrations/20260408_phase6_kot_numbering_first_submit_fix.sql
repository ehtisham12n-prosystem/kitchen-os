UPDATE `kots` k
INNER JOIN `orders` o
  ON CAST(o.`id` AS CHAR(36)) COLLATE utf8mb4_unicode_ci = k.`order_id` COLLATE utf8mb4_unicode_ci
SET k.`kot_number` = CASE
  WHEN COALESCE(o.`kot_base_number`, 0) <= 0 THEN k.`kot_number`
  WHEN COALESCE(o.`kot_version`, 0) <= 1 THEN LPAD(CAST(o.`kot_base_number` AS CHAR), 3, '0')
  ELSE CONCAT(LPAD(CAST(o.`kot_base_number` AS CHAR), 3, '0'), '-', CAST(o.`kot_version` - 1 AS CHAR))
END
WHERE o.`kot_base_number` IS NOT NULL;
