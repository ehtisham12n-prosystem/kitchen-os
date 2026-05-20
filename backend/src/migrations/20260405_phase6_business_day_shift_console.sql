CREATE TABLE IF NOT EXISTS `business_days` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `title` varchar(120) NOT NULL,
  `business_date` date NOT NULL,
  `opened_at` datetime NULL,
  `planned_closing_at` datetime NULL,
  `closed_at` datetime NULL,
  `status` enum('open','closed','off_day','cancelled') NOT NULL DEFAULT 'open',
  `is_off_day` tinyint(1) NOT NULL DEFAULT 0,
  `off_day_reason` text NULL,
  `notes` text NULL,
  `opened_by_user_id` int NULL,
  `closed_by_user_id` int NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_business_days_branch_date` (`client_id`, `branch_id`, `business_date`),
  KEY `IDX_business_days_status` (`client_id`, `branch_id`, `status`)
);

CREATE TABLE IF NOT EXISTS `shift_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NULL,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `planned_start_time` time NOT NULL,
  `planned_end_time` time NOT NULL,
  `sort_order` int NOT NULL DEFAULT 1,
  `allow_overlap` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_shift_templates_branch` (`client_id`, `branch_id`, `is_active`),
  KEY `IDX_shift_templates_code` (`client_id`, `branch_id`, `code`)
);

ALTER TABLE `shifts`
  ADD COLUMN IF NOT EXISTS `business_day_id` int NULL AFTER `branch_id`,
  ADD COLUMN IF NOT EXISTS `shift_template_id` int NULL AFTER `business_day_id`,
  ADD COLUMN IF NOT EXISTS `shift_name` varchar(100) NULL AFTER `sale_counter_id`,
  ADD COLUMN IF NOT EXISTS `shift_code` varchar(50) NULL AFTER `shift_name`,
  ADD COLUMN IF NOT EXISTS `shift_order` int NULL AFTER `shift_code`,
  ADD COLUMN IF NOT EXISTS `planned_start` datetime NULL AFTER `business_date`,
  ADD COLUMN IF NOT EXISTS `planned_end` datetime NULL AFTER `planned_start`,
  ADD COLUMN IF NOT EXISTS `actual_start` datetime NULL AFTER `planned_end`,
  ADD COLUMN IF NOT EXISTS `actual_end` datetime NULL AFTER `actual_start`,
  ADD INDEX `IDX_shifts_business_day_id` (`business_day_id`),
  ADD INDEX `IDX_shifts_shift_template_id` (`shift_template_id`),
  ADD INDEX `IDX_shifts_business_date_status` (`client_id`, `branch_id`, `business_date`, `status`);

UPDATE `shifts`
SET
  `actual_start` = COALESCE(`actual_start`, `opened_at`),
  `actual_end` = COALESCE(`actual_end`, `closed_at`)
WHERE `actual_start` IS NULL OR `actual_end` IS NULL;

ALTER TABLE `authorized_tills`
  ADD COLUMN IF NOT EXISTS `opening_verified_cash` decimal(12,2) NULL AFTER `assigned_float`,
  ADD COLUMN IF NOT EXISTS `opening_verified_at` datetime NULL AFTER `opening_verified_cash`,
  ADD COLUMN IF NOT EXISTS `opening_verified_by_user_id` int NULL AFTER `opening_verified_at`,
  ADD INDEX `IDX_authorized_tills_user_status` (`client_id`, `branch_id`, `user_id`, `terminal_status`);

ALTER TABLE `attendance_logs`
  ADD COLUMN IF NOT EXISTS `business_day_id` int NULL AFTER `branch_id`,
  ADD COLUMN IF NOT EXISTS `shift_id` int NULL AFTER `business_day_id`,
  ADD INDEX `IDX_attendance_logs_business_day` (`client_id`, `branch_id`, `business_day_id`),
  ADD INDEX `IDX_attendance_logs_shift` (`client_id`, `branch_id`, `shift_id`);
