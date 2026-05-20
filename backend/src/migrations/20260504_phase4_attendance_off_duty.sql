ALTER TABLE `attendance_logs`
  MODIFY COLUMN `status` ENUM('present', 'absent', 'late', 'leave', 'off_duty') NOT NULL DEFAULT 'present';
