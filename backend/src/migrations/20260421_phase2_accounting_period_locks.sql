CREATE TABLE IF NOT EXISTS accounting_period_locks (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NULL,
  mode ENUM('none', 'admin_override', 'hard_lock') NOT NULL DEFAULT 'none',
  locked_through_date DATE NULL,
  notes VARCHAR(500) NULL,
  updated_by VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_accounting_period_locks_client_branch (client_id, branch_id)
);
