-- ============================================================
-- Phase 2: "Contract" Model Migration
-- Date: 2026-03-08
-- Description:
--   1. Drops the branch_id column from users table (after FK is removed)
--   2. Creates user_branch_roles junction table
--   3. Creates user_branch_permissions junction table
-- ============================================================

START TRANSACTION;

-- Step 1: Drop FK constraint on branch_id if it exists
-- Run this query to find the constraint name first:
--   SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
--   WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'branch_id' AND TABLE_SCHEMA = DATABASE();
-- Then replace FK_users_branch_id below with the actual constraint name.

SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'users'
      AND COLUMN_NAME = 'branch_id'
      AND REFERENCED_TABLE_NAME = 'branches'
      AND TABLE_SCHEMA = DATABASE()
    LIMIT 1
);

-- Step 2: Conditionally drop the FK and then the column
-- (MySQL does not support IF EXISTS for FK constraints directly; use dynamic SQL)
SET @drop_fk = IF(
    @fk_name IS NOT NULL,
    CONCAT('ALTER TABLE `users` DROP FOREIGN KEY `', @fk_name, '`'),
    'SELECT 1' -- no-op
);
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Drop the branch_id column (IF EXISTS for idempotency)
ALTER TABLE `users`
    DROP COLUMN IF EXISTS `branch_id`;

-- ============================================================
-- Step 4: Create user_branch_roles table
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_branch_roles` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `user_id`    INT          NOT NULL,
    `branch_id`  INT          NOT NULL,
    `role_id`    INT          NULL,
    `is_primary` TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at` DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `UQ_ubr_user_branch` (`user_id`, `branch_id`),
    CONSTRAINT `FK_ubr_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`    (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ubr_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ubr_role`   FOREIGN KEY (`role_id`)   REFERENCES `roles`    (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Step 5: Create user_branch_permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_branch_permissions` (
    `id`            INT          NOT NULL AUTO_INCREMENT,
    `user_id`       INT          NOT NULL,
    `branch_id`     INT          NOT NULL,
    `permission_id` VARCHAR(150) NOT NULL,
    `created_at`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `UQ_ubp_user_branch_perm` (`user_id`, `branch_id`, `permission_id`),
    CONSTRAINT `FK_ubp_user`   FOREIGN KEY (`user_id`)   REFERENCES `users`    (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ubp_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;
