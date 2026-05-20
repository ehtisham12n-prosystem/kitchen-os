ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `country` varchar(100) NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `designation` varchar(120) NULL AFTER `country`,
  ADD COLUMN IF NOT EXISTS `organization` varchar(150) NULL AFTER `designation`,
  ADD COLUMN IF NOT EXISTS `allow_credit` tinyint(1) NOT NULL DEFAULT 0 AFTER `organization`,
  ADD COLUMN IF NOT EXISTS `credit_limit` decimal(12,2) NOT NULL DEFAULT 0.00 AFTER `allow_credit`;

UPDATE `customers`
SET `customer_code` = CONCAT('CUS-', LPAD(`id`, 6, '0'))
WHERE (`customer_code` IS NULL OR TRIM(`customer_code`) = '');
