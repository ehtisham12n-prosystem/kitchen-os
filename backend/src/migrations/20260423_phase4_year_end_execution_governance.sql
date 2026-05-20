ALTER TABLE accounting_period_locks
    ADD COLUMN year_end_finalized_period_key VARCHAR(7) NULL AFTER last_reopen_reason,
    ADD COLUMN year_end_finalized_by VARCHAR(100) NULL AFTER year_end_finalized_period_key,
    ADD COLUMN year_end_finalized_at DATETIME NULL AFTER year_end_finalized_by,
    ADD COLUMN year_end_close_journal_entry_id INT NULL AFTER year_end_finalized_at,
    ADD COLUMN year_end_reopened_by VARCHAR(100) NULL AFTER year_end_close_journal_entry_id,
    ADD COLUMN year_end_reopened_at DATETIME NULL AFTER year_end_reopened_by,
    ADD COLUMN year_end_reopen_reason VARCHAR(500) NULL AFTER year_end_reopened_at;
