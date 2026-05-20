CREATE TABLE IF NOT EXISTS `attendance_locks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(20) NOT NULL,
  `branch_id` INT NULL,
  `date_from` DATE NOT NULL,
  `date_to` DATE NOT NULL,
  `locked_by` INT NOT NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `IDX_attendance_locks_scope` (`client_id`, `branch_id`, `date_from`, `date_to`),
  CONSTRAINT `FK_attendance_locks_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);
