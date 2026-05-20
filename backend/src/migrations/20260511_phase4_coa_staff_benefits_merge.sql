UPDATE accounting_coa
SET
  account_name = 'Staff Benefits',
  description = 'Staff insurance, medical, rewards, recognition, and similar employee benefit costs.',
  usage_guidance = 'Use for approved staff benefits outside regular salary and wage lines.',
  example_entry = 'Staff health insurance, medical reimbursement, or employee reward.',
  confusion_note = 'Business insurance belongs in Insurance Expense, not staff benefits.',
  updated_at = NOW()
WHERE account_code = '5235';

UPDATE accounting_journal_items item
JOIN accounting_coa source
  ON source.id = item.account_id
 AND source.account_code IN ('5240', '5245')
JOIN accounting_coa target
  ON target.client_id = source.client_id
 AND target.account_code = '5235'
SET item.account_id = target.id;

UPDATE financial_vouchers voucher
JOIN accounting_coa source
  ON source.id = voucher.expense_account_id
 AND source.account_code IN ('5240', '5245')
JOIN accounting_coa target
  ON target.client_id = source.client_id
 AND target.account_code = '5235'
SET voucher.expense_account_id = target.id;

DELETE coa
FROM accounting_coa coa
LEFT JOIN accounting_journal_items item
  ON item.account_id = coa.id
LEFT JOIN financial_vouchers voucher
  ON voucher.expense_account_id = coa.id
WHERE coa.account_code IN ('5240', '5245', '4600')
  AND item.id IS NULL
  AND voucher.id IS NULL;
