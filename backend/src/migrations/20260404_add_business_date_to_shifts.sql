ALTER TABLE `shifts`
  ADD COLUMN IF NOT EXISTS `business_date` date NULL AFTER `opened_at`,
  ADD COLUMN IF NOT EXISTS `is_day_open` tinyint(1) NOT NULL DEFAULT 0 AFTER `business_date`;
