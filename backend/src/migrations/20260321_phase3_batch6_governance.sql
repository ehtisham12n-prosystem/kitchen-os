ALTER TABLE `clients`
  ADD COLUMN `governance_state` ENUM('normal', 'restricted', 'suspended', 'closure_pending', 'closed') NOT NULL DEFAULT 'normal' AFTER `client_status`,
  ADD COLUMN `governance_context` ENUM('non_payment', 'trial_expiry', 'policy_issue', 'abuse_risk', 'admin_hold', 'manual_override') NULL AFTER `governance_state`,
  ADD COLUMN `governance_reason` VARCHAR(255) NULL AFTER `governance_context`,
  ADD COLUMN `governance_notes` TEXT NULL AFTER `governance_reason`,
  ADD COLUMN `governance_updated_at` DATETIME NULL AFTER `governance_notes`,
  ADD COLUMN `governance_updated_by` VARCHAR(255) NULL AFTER `governance_updated_at`;

CREATE TABLE `client_governance_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(20) NOT NULL,
  `action_type` VARCHAR(80) NOT NULL,
  `from_state` ENUM('normal', 'restricted', 'suspended', 'closure_pending', 'closed') NULL,
  `to_state` ENUM('normal', 'restricted', 'suspended', 'closure_pending', 'closed') NOT NULL,
  `trigger_context` ENUM('non_payment', 'trial_expiry', 'policy_issue', 'abuse_risk', 'admin_hold', 'manual_override') NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `changed_by` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_client_governance_history_client_created` (`client_id`, `created_at`),
  CONSTRAINT `FK_client_governance_history_client`
    FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
);
