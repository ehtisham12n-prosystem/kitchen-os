ALTER TABLE `kots`
  ADD COLUMN IF NOT EXISTS `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

UPDATE `kots`
SET `updated_at` = `created_at`
WHERE `updated_at` IS NULL OR `updated_at` < '1000-01-01 00:00:00';
