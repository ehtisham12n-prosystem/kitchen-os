ALTER TABLE `accounting_payroll_runs`
  DROP INDEX `uq_accounting_payroll_runs_scope`;

CREATE INDEX `idx_accounting_payroll_runs_scope`
  ON `accounting_payroll_runs` (`client_id`, `branch_id`, `period_start`, `period_end`);
