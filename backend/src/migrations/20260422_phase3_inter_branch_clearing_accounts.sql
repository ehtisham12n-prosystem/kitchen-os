INSERT INTO `accounting_coa` (
  `client_id`,
  `account_code`,
  `account_name`,
  `account_type`,
  `parent_id`,
  `branch_id`,
  `scope`,
  `is_active`,
  `schedule_code`,
  `is_control_account`,
  `allow_manual_posting`,
  `is_bank_account`,
  `is_cash_account`,
  `is_petty_cash_account`,
  `is_system`
)
SELECT
  parent.`client_id`,
  '1220',
  'Inter-Branch Clearing Receivable',
  'asset',
  NULL,
  NULL,
  'branch',
  1,
  'BS_RECEIVABLES',
  1,
  1,
  0,
  0,
  0,
  1
FROM `accounting_coa` parent
WHERE parent.`account_code` = '1000'
  AND NOT EXISTS (
    SELECT 1
    FROM `accounting_coa` existing
    WHERE existing.`client_id` = parent.`client_id`
      AND existing.`account_code` = '1220'
  );

INSERT INTO `accounting_coa` (
  `client_id`,
  `account_code`,
  `account_name`,
  `account_type`,
  `parent_id`,
  `branch_id`,
  `scope`,
  `is_active`,
  `schedule_code`,
  `is_control_account`,
  `allow_manual_posting`,
  `is_bank_account`,
  `is_cash_account`,
  `is_petty_cash_account`,
  `is_system`
)
SELECT
  parent.`client_id`,
  '2120',
  'Inter-Branch Clearing Payable',
  'liability',
  NULL,
  NULL,
  'branch',
  1,
  'BS_PAYABLES',
  1,
  1,
  0,
  0,
  0,
  1
FROM `accounting_coa` parent
WHERE parent.`account_code` = '2000'
  AND NOT EXISTS (
    SELECT 1
    FROM `accounting_coa` existing
    WHERE existing.`client_id` = parent.`client_id`
      AND existing.`account_code` = '2120'
  );
