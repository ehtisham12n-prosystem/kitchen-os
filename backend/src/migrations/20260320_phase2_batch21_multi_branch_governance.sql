ALTER TABLE `branches`
  MODIFY COLUMN `status` enum('setup_pending','active','inactive','suspended') NOT NULL DEFAULT 'setup_pending';
