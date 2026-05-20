INSERT INTO accounting_coa (
  client_id,
  account_code,
  account_name,
  account_type,
  parent_id,
  branch_id,
  scope,
  is_active,
  description,
  usage_guidance,
  example_entry,
  confusion_note,
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
  template.account_code,
  template.account_name,
  template.account_type,
  parent.id,
  NULL,
  template.scope,
  1,
  template.description,
  template.usage_guidance,
  template.example_entry,
  template.confusion_note,
  template.schedule_code,
  template.is_control_account,
  1,
  0,
  0,
  0,
  1,
  NOW(),
  NOW()
FROM (
  SELECT '2207' AS account_code, 'Customer Wallet Liability' AS account_name, 'liability' AS account_type, '2205' AS parent_code, 'branch' AS scope, 'BS_LIABILITIES' AS schedule_code, 1 AS is_control_account,
         'Customer wallet balances and prepaid store credit owed back to customers until used.' AS description,
         'Use for wallet top-ups, stored value, and customer credit balances that are not yet earned revenue.' AS usage_guidance,
         'Customer adds money to wallet before placing orders.' AS example_entry,
         'Do not treat wallet top-up as sales revenue. Revenue is earned when the wallet is used against a sale.' AS confusion_note
  UNION ALL
  SELECT '4600', 'Other Income', 'revenue', '4000', 'branch', 'PL_OTHER_INCOME', 0,
         'Other income that is not regular sales, service charges, internal recharge, cash overage, or bank profit.',
         'Use for occasional miscellaneous income after confirming no more specific income account applies.',
         'One-off recovery or miscellaneous income receipt.',
         'Do not use for POS or wallet sales; those remain normal sales revenue by business line.'
  UNION ALL
  SELECT '5190', 'Other Direct COGS', 'expense', '5100', 'branch', 'PL_COGS', 0,
         'Other direct cost of sales that does not fit raw material, beverage, bakery, packaging, event, or bulk-cooking cost.',
         'Use only for costs directly tied to earning sales where a more specific COGS account does not apply.',
         'Minor direct production cost not covered by standard COGS lines.',
         'Do not use for operating overhead such as fuel, utilities, or office supplies.'
  UNION ALL
  SELECT '5235', 'Staff Insurance Benefits', 'expense', '5200', 'branch', 'PL_PAYROLL', 0,
         'Insurance benefits provided to staff as part of compensation or welfare policy.',
         'Use for employee insurance benefit costs, separate from business asset or premises insurance.',
         'Staff health or life insurance premium paid by employer.',
         'Business insurance belongs in Insurance Expense, not staff benefits.'
  UNION ALL
  SELECT '5240', 'Staff Medical Benefits', 'expense', '5200', 'branch', 'PL_PAYROLL', 0,
         'Medical support and healthcare benefits provided to staff.',
         'Use for approved employee medical reimbursements or staff clinic benefits.',
         'Medical reimbursement paid to an employee under policy.',
         NULL
  UNION ALL
  SELECT '5245', 'Staff Rewards & Incentives', 'expense', '5200', 'branch', 'PL_PAYROLL', 0,
         'Staff rewards, recognition, bonuses, and non-salary incentive costs.',
         'Use for rewards or incentives outside regular salary and wage lines.',
         'Employee of the month reward or approved performance incentive.',
         NULL
  UNION ALL
  SELECT '5395', 'Entertainment Expense', 'expense', '5000', 'branch', 'PL_OPERATING', 0,
         'Entertainment and hospitality cost incurred for business purposes.',
         'Use for approved guest entertainment, staff events, or business hospitality where policy allows.',
         'Approved business meal or team event expense.',
         'Customer discounts and promotions belong in sales or marketing accounts, not entertainment.'
) template
JOIN accounting_coa parent
  ON parent.account_code = template.parent_code
LEFT JOIN accounting_coa existing
  ON existing.client_id = parent.client_id
 AND existing.account_code = template.account_code
WHERE existing.id IS NULL;
