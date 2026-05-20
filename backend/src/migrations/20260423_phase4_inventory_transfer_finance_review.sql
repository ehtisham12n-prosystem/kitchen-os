ALTER TABLE inventory_transfers
  ADD COLUMN finance_reviewed_by varchar(100) NULL,
  ADD COLUMN finance_reviewed_by_name varchar(150) NULL,
  ADD COLUMN finance_reviewed_at datetime NULL,
  ADD COLUMN finance_review_notes text NULL;
