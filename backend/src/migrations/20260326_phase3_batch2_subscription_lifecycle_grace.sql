ALTER TABLE `client_subscriptions`
  MODIFY COLUMN `subscription_status` ENUM('pending', 'trial', 'active', 'grace', 'expired', 'suspended', 'cancelled') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS `grace_start_at` DATETIME NULL AFTER `effective_end_at`,
  ADD COLUMN IF NOT EXISTS `grace_end_at` DATETIME NULL AFTER `grace_start_at`;
