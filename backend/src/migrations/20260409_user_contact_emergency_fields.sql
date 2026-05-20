ALTER TABLE `users`
  ADD COLUMN `alternate_phone` varchar(20) NULL AFTER `phone`,
  ADD COLUMN `emergency_contact_name` varchar(150) NULL AFTER `alternate_phone`,
  ADD COLUMN `emergency_contact_relationship` varchar(100) NULL AFTER `emergency_contact_name`,
  ADD COLUMN `emergency_contact_phone` varchar(20) NULL AFTER `emergency_contact_relationship`;
