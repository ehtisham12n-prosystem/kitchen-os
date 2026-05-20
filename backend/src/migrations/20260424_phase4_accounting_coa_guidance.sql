ALTER TABLE `accounting_coa`
  ADD COLUMN `description` varchar(1000) DEFAULT NULL AFTER `is_active`,
  ADD COLUMN `usage_guidance` varchar(1500) DEFAULT NULL AFTER `description`,
  ADD COLUMN `example_entry` varchar(500) DEFAULT NULL AFTER `usage_guidance`,
  ADD COLUMN `confusion_note` varchar(500) DEFAULT NULL AFTER `example_entry`;
