ALTER TABLE `branches`
  ADD COLUMN IF NOT EXISTS `inherit_client_currency` tinyint(1) NOT NULL DEFAULT 1 AFTER `theme_id`,
  ADD COLUMN IF NOT EXISTS `inherit_client_language` tinyint(1) NOT NULL DEFAULT 1 AFTER `inherit_client_currency`,
  ADD COLUMN IF NOT EXISTS `inherit_client_theme` tinyint(1) NOT NULL DEFAULT 1 AFTER `inherit_client_language`;

ALTER TABLE `branches`
  MODIFY COLUMN `status` enum('active','inactive','suspended') NOT NULL DEFAULT 'inactive';

CREATE UNIQUE INDEX `IDX_branches_client_branch_code`
  ON `branches` (`client_id`, `branch_code`);
