ALTER TABLE accounting_journal_entries
  ADD COLUMN is_accrual TINYINT(1) NOT NULL DEFAULT 0 AFTER reversed_at;

ALTER TABLE accounting_journal_entries
  ADD COLUMN accrual_reversal_due_date DATE NULL AFTER is_accrual;

ALTER TABLE accounting_journal_entries
  ADD COLUMN accrual_reversal_status ENUM('pending', 'reversed') NULL AFTER accrual_reversal_due_date;

CREATE TABLE IF NOT EXISTS accounting_close_checklist_items (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,
  period_key VARCHAR(7) NOT NULL,
  item_key VARCHAR(60) NOT NULL,
  item_label VARCHAR(120) NOT NULL,
  status ENUM('pending', 'completed', 'blocked') NOT NULL DEFAULT 'pending',
  notes VARCHAR(500) NULL,
  completed_by VARCHAR(100) NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounting_close_checklist_item (client_id, branch_id, period_key, item_key),
  KEY idx_accounting_close_checklist_branch_period (client_id, branch_id, period_key)
);
