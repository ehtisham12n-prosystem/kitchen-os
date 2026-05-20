CREATE TABLE IF NOT EXISTS accounting_treasury_exceptions (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,
  exception_type VARCHAR(50) NOT NULL,
  exception_key VARCHAR(120) NOT NULL,
  status ENUM('open', 'in_review', 'resolved', 'waived') NOT NULL DEFAULT 'open',
  owner_name VARCHAR(120) NULL,
  notes VARCHAR(1000) NULL,
  updated_by VARCHAR(120) NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_treasury_exception_scope (client_id, branch_id, exception_type, exception_key),
  KEY idx_treasury_exception_status (client_id, branch_id, status)
);
