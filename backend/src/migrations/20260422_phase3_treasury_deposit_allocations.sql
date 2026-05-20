CREATE TABLE IF NOT EXISTS accounting_treasury_deposit_allocations (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  branch_id INT NOT NULL,
  deposit_entry_id INT NOT NULL,
  handover_entry_id INT NOT NULL,
  allocated_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_treasury_deposit_allocation_pair (deposit_entry_id, handover_entry_id),
  KEY idx_treasury_deposit_allocation_deposit (client_id, branch_id, deposit_entry_id),
  KEY idx_treasury_deposit_allocation_handover (client_id, branch_id, handover_entry_id)
);
