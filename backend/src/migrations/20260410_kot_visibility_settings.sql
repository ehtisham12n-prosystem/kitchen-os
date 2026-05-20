ALTER TABLE `client_settings`
  ADD COLUMN `show_kot_full_logo` tinyint(1) NOT NULL DEFAULT 0 AFTER `show_receipt_footer_message_2`,
  ADD COLUMN `show_kot_short_logo` tinyint(1) NOT NULL DEFAULT 0 AFTER `show_kot_full_logo`,
  ADD COLUMN `show_kot_business_name` tinyint(1) NOT NULL DEFAULT 1 AFTER `show_kot_short_logo`,
  ADD COLUMN `show_kot_branch_name` tinyint(1) NOT NULL DEFAULT 1 AFTER `show_kot_business_name`,
  ADD COLUMN `show_kot_branch_address` tinyint(1) NOT NULL DEFAULT 0 AFTER `show_kot_branch_name`,
  ADD COLUMN `show_kot_contact_number` tinyint(1) NOT NULL DEFAULT 0 AFTER `show_kot_branch_address`,
  ADD COLUMN `show_kot_footer_message_1` tinyint(1) NOT NULL DEFAULT 0 AFTER `show_kot_contact_number`,
  ADD COLUMN `show_kot_footer_message_2` tinyint(1) NOT NULL DEFAULT 0 AFTER `show_kot_footer_message_1`;
