INSERT INTO `permissions` (`key`, `module`, `action`, `scope`, `created_at`, `updated_at`)
VALUES
  ('user_history.view.branch', 'user_history', 'view', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('user_history.transactions.branch', 'user_history', 'transactions', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('user_history.audit.branch', 'user_history', 'audit', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
  ('user_history.export.branch', 'user_history', 'export', 'branch', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
  `module` = VALUES(`module`),
  `action` = VALUES(`action`),
  `scope` = VALUES(`scope`),
  `updated_at` = CURRENT_TIMESTAMP(6);
