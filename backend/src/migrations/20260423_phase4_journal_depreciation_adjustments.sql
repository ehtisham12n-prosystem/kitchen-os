ALTER TABLE `accounting_journal_entries`
  MODIFY COLUMN `close_adjustment_type` enum('prepaid_expense','deferred_revenue','depreciation') NULL;
