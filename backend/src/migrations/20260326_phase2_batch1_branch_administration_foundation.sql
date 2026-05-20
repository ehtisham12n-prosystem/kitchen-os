ALTER TABLE `branches`
  ADD COLUMN `operating_hours` json NULL AFTER `closing_time`,
  ADD COLUMN `document_settings` json NULL AFTER `operating_hours`,
  ADD COLUMN `tax_settings` json NULL AFTER `document_settings`,
  ADD COLUMN `operational_settings` json NULL AFTER `tax_settings`;
