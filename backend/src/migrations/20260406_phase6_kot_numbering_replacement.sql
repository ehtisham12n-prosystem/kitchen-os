ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `kot_base_number` int NULL AFTER `order_number`,
  ADD COLUMN IF NOT EXISTS `kot_version` int NOT NULL DEFAULT 0 AFTER `kot_base_number`,
  ADD COLUMN IF NOT EXISTS `last_kot_submission_hash` char(64) NULL AFTER `kot_version`,
  ADD UNIQUE KEY `UQ_orders_kot_base_number` (`kot_base_number`);

CREATE TABLE IF NOT EXISTS `pos_kot_sequences` (
  `id` tinyint unsigned NOT NULL,
  `last_base_number` int NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

INSERT INTO `pos_kot_sequences` (`id`, `last_base_number`)
SELECT 1, COALESCE(MAX(`kot_base_number`), 0)
FROM `orders`
ON DUPLICATE KEY UPDATE `last_base_number` = GREATEST(`last_base_number`, VALUES(`last_base_number`));
