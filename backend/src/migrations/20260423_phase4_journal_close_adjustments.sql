ALTER TABLE `accounting_journal_entries`
  ADD COLUMN `close_adjustment_type` ENUM('prepaid_expense', 'deferred_revenue') NULL AFTER `accrual_reversal_status`,
  ADD COLUMN `schedule_start_date` DATE NULL AFTER `close_adjustment_type`,
  ADD COLUMN `schedule_end_date` DATE NULL AFTER `schedule_start_date`;
