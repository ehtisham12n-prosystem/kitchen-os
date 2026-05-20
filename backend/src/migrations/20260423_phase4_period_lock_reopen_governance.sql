ALTER TABLE `accounting_period_locks`
  ADD COLUMN `last_reopened_by` varchar(100) NULL AFTER `updated_by`,
  ADD COLUMN `last_reopened_at` datetime NULL AFTER `last_reopened_by`,
  ADD COLUMN `last_reopen_reason` varchar(500) NULL AFTER `last_reopened_at`;
