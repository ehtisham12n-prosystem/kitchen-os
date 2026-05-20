ALTER TABLE `audit_logs`
  ADD COLUMN `actor_type` varchar(50) NULL AFTER `UserManagement_role`,
  ADD COLUMN `client_id` varchar(20) NULL AFTER `actor_type`,
  ADD COLUMN `branch_id` int NULL AFTER `client_id`,
  ADD COLUMN `entity_id` varchar(100) NULL AFTER `branch_id`,
  ADD COLUMN `request_method` varchar(10) NULL AFTER `entity_id`,
  ADD COLUMN `request_path` varchar(255) NULL AFTER `request_method`;

UPDATE `audit_logs`
SET
  `actor_type` = COALESCE(`actor_type`, JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.actor_type'))),
  `client_id` = COALESCE(`client_id`, JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.client_id'))),
  `branch_id` = COALESCE(`branch_id`, CAST(JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.branch_id')) AS SIGNED)),
  `entity_id` = COALESCE(`entity_id`, JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.entity_id'))),
  `request_method` = COALESCE(`request_method`, JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.request_method')), JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.method'))),
  `request_path` = COALESCE(`request_path`, JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.request_path')), JSON_UNQUOTE(JSON_EXTRACT(`metadata_json`, '$.url')));

CREATE INDEX `idx_audit_logs_timestamp` ON `audit_logs` (`timestamp`);
CREATE INDEX `idx_audit_logs_client_timestamp` ON `audit_logs` (`client_id`, `timestamp`);
CREATE INDEX `idx_audit_logs_branch_timestamp` ON `audit_logs` (`branch_id`, `timestamp`);
CREATE INDEX `idx_audit_logs_status_portal` ON `audit_logs` (`status`, `portal`);
