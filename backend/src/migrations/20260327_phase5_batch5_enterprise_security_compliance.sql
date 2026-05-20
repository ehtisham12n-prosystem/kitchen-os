SET @schema_name := DATABASE();

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'failed_login_attempts'
  ) = 0,
  'ALTER TABLE `users` ADD COLUMN `failed_login_attempts` int NOT NULL DEFAULT 0 AFTER `wrong_attempts_limit`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'locked_at'
  ) = 0,
  'ALTER TABLE `users` ADD COLUMN `locked_at` datetime NULL AFTER `failed_login_attempts`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'last_login_ip'
  ) = 0,
  'ALTER TABLE `users` ADD COLUMN `last_login_ip` varchar(64) NULL AFTER `last_login`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND COLUMN_NAME = 'tenant_slug'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD COLUMN `tenant_slug` varchar(120) NULL AFTER `UserManagement_agent`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND COLUMN_NAME = 'failure_reason'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD COLUMN `failure_reason` varchar(255) NULL AFTER `tenant_slug`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND COLUMN_NAME = 'session_id'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD COLUMN `session_id` char(36) NULL AFTER `failure_reason`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND COLUMN_NAME = 'request_id'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD COLUMN `request_id` varchar(100) NULL AFTER `session_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND COLUMN_NAME = 'retention_until'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD COLUMN `retention_until` datetime NULL AFTER `request_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` char(36) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `username` varchar(150) NULL,
  `user_type` enum('system','client','customer') NOT NULL,
  `client_id` varchar(20) NULL,
  `branch_id` int NULL,
  `tenant_slug` varchar(120) NULL,
  `portal` enum('Nexus','Console','Terminal','Public') NOT NULL DEFAULT 'Console',
  `ip_address` varchar(64) NULL,
  `user_agent` text NULL,
  `device_label` varchar(120) NULL,
  `status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `last_seen_at` datetime NULL,
  `last_seen_ip` varchar(64) NULL,
  `last_seen_user_agent` text NULL,
  `last_seen_path` varchar(255) NULL,
  `revoked_at` datetime NULL,
  `revoke_reason` varchar(255) NULL,
  `request_id` varchar(100) NULL,
  `retention_until` datetime NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_auth_sessions_session_id` (`session_id`)
);

CREATE TABLE IF NOT EXISTS `auth_access_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` char(36) NULL,
  `request_id` varchar(100) NULL,
  `user_id` varchar(64) NULL,
  `username` varchar(150) NULL,
  `user_type` varchar(30) NULL,
  `client_id` varchar(20) NULL,
  `branch_id` int NULL,
  `portal` enum('Nexus','Console','Terminal','Public') NOT NULL DEFAULT 'Console',
  `request_method` varchar(10) NOT NULL,
  `request_path` varchar(255) NOT NULL,
  `status_code` int NOT NULL,
  `ip_address` varchar(64) NULL,
  `user_agent` text NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `retention_until` datetime NULL,
  PRIMARY KEY (`id`)
);

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'IDX_users_lockout_status'
  ) = 0,
  'ALTER TABLE `users` ADD INDEX `IDX_users_lockout_status` (`is_locked`, `failed_login_attempts`, `last_login`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND INDEX_NAME = 'IDX_auth_audits_status_created'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD INDEX `IDX_auth_audits_status_created` (`attempt_status`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_audits'
      AND INDEX_NAME = 'IDX_auth_audits_user_created'
  ) = 0,
  'ALTER TABLE `auth_audits` ADD INDEX `IDX_auth_audits_user_created` (`user_id`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_sessions'
      AND INDEX_NAME = 'IDX_auth_sessions_status_seen'
  ) = 0,
  'ALTER TABLE `auth_sessions` ADD INDEX `IDX_auth_sessions_status_seen` (`status`, `last_seen_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_sessions'
      AND INDEX_NAME = 'IDX_auth_sessions_user_status'
  ) = 0,
  'ALTER TABLE `auth_sessions` ADD INDEX `IDX_auth_sessions_user_status` (`user_id`, `status`, `issued_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_sessions'
      AND INDEX_NAME = 'IDX_auth_sessions_client_status'
  ) = 0,
  'ALTER TABLE `auth_sessions` ADD INDEX `IDX_auth_sessions_client_status` (`client_id`, `status`, `last_seen_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_access_logs'
      AND INDEX_NAME = 'IDX_auth_access_logs_created'
  ) = 0,
  'ALTER TABLE `auth_access_logs` ADD INDEX `IDX_auth_access_logs_created` (`created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_access_logs'
      AND INDEX_NAME = 'IDX_auth_access_logs_session_created'
  ) = 0,
  'ALTER TABLE `auth_access_logs` ADD INDEX `IDX_auth_access_logs_session_created` (`session_id`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (
    SELECT COUNT(1)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'auth_access_logs'
      AND INDEX_NAME = 'IDX_auth_access_logs_client_portal_created'
  ) = 0,
  'ALTER TABLE `auth_access_logs` ADD INDEX `IDX_auth_access_logs_client_portal_created` (`client_id`, `portal`, `created_at`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
