ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_details JSON NULL AFTER reference_number;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS voided_at DATETIME NULL AFTER receipt_number,
  ADD COLUMN IF NOT EXISTS void_reason VARCHAR(255) NULL AFTER voided_at,
  ADD COLUMN IF NOT EXISTS void_authorized_by_user_id INT NULL AFTER void_reason,
  ADD COLUMN IF NOT EXISTS void_authorized_by_username VARCHAR(150) NULL AFTER void_authorized_by_user_id;

CREATE TABLE IF NOT EXISTS pos_card_machines (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,
  machine_name VARCHAR(120) NOT NULL,
  service_provider VARCHAR(120) NOT NULL,
  pid_number VARCHAR(80) NOT NULL,
  mid_number VARCHAR(80) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pos_card_machines_client_branch_name (client_id, branch_id, machine_name),
  KEY idx_pos_card_machines_client_branch_active (client_id, branch_id, is_active)
);
