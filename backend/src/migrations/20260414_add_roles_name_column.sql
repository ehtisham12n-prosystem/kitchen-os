ALTER TABLE `roles`
  ADD COLUMN IF NOT EXISTS `name` varchar(100) NULL AFTER `role_name`;

UPDATE `roles`
SET `name` = `role_name`
WHERE `name` IS NULL OR TRIM(`name`) = '';
