ALTER TABLE catering_event_settlements
  MODIFY COLUMN settlement_type ENUM('advance', 'collection', 'advance_refund', 'collection_refund', 'write_off') NOT NULL DEFAULT 'collection';

INSERT INTO accounting_coa (
  client_id,
  account_code,
  account_name,
  account_type,
  parent_id,
  branch_id,
  scope,
  is_active,
  schedule_code,
  is_control_account,
  allow_manual_posting,
  is_bank_account,
  is_cash_account,
  is_petty_cash_account,
  is_system,
  created_at,
  updated_at
)
SELECT
  parent.client_id,
  '5700',
  'Event Refunds & Write-Offs',
  'expense',
  parent.id,
  NULL,
  'branch',
  1,
  'PL_OPERATING',
  0,
  0,
  0,
  0,
  0,
  1,
  NOW(),
  NOW()
FROM accounting_coa parent
LEFT JOIN accounting_coa existing
  ON existing.client_id = parent.client_id
 AND existing.account_code = '5700'
WHERE parent.account_code = '5000'
  AND existing.id IS NULL;
