ALTER TABLE financial_vouchers
  ADD COLUMN status_note TEXT NULL AFTER status,
  ADD COLUMN rejected_at DATETIME NULL AFTER approved_by,
  ADD COLUMN rejected_by INT NULL AFTER rejected_at;
