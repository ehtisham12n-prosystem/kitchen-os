SET @coa_schedule_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounting_coa'
    AND column_name = 'schedule_code'
);
SET @coa_schedule_sql := IF(
  @coa_schedule_exists = 0,
  'ALTER TABLE accounting_coa ADD COLUMN schedule_code varchar(30) NULL AFTER is_active',
  'SELECT 1'
);
PREPARE stmt FROM @coa_schedule_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @coa_control_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounting_coa'
    AND column_name = 'is_control_account'
);
SET @coa_control_sql := IF(
  @coa_control_exists = 0,
  'ALTER TABLE accounting_coa ADD COLUMN is_control_account tinyint(1) NOT NULL DEFAULT 0 AFTER schedule_code',
  'SELECT 1'
);
PREPARE stmt FROM @coa_control_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @coa_manual_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounting_coa'
    AND column_name = 'allow_manual_posting'
);
SET @coa_manual_sql := IF(
  @coa_manual_exists = 0,
  'ALTER TABLE accounting_coa ADD COLUMN allow_manual_posting tinyint(1) NOT NULL DEFAULT 1 AFTER is_control_account',
  'SELECT 1'
);
PREPARE stmt FROM @coa_manual_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @coa_bank_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounting_coa'
    AND column_name = 'is_bank_account'
);
SET @coa_bank_sql := IF(
  @coa_bank_exists = 0,
  'ALTER TABLE accounting_coa ADD COLUMN is_bank_account tinyint(1) NOT NULL DEFAULT 0 AFTER allow_manual_posting',
  'SELECT 1'
);
PREPARE stmt FROM @coa_bank_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @coa_cash_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounting_coa'
    AND column_name = 'is_cash_account'
);
SET @coa_cash_sql := IF(
  @coa_cash_exists = 0,
  'ALTER TABLE accounting_coa ADD COLUMN is_cash_account tinyint(1) NOT NULL DEFAULT 0 AFTER is_bank_account',
  'SELECT 1'
);
PREPARE stmt FROM @coa_cash_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id int NOT NULL AUTO_INCREMENT,
  client_id varchar(20) NOT NULL,
  branch_id int NOT NULL,
  purchase_order_id int DEFAULT NULL,
  vendor_id int DEFAULT NULL,
  grn_number varchar(50) NOT NULL,
  receipt_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status enum('posted','voided') NOT NULL DEFAULT 'posted',
  vendor_invoice_number varchar(100) DEFAULT NULL,
  vendor_bill_reference varchar(100) DEFAULT NULL,
  vendor_bill_date date DEFAULT NULL,
  vendor_bill_due_date date DEFAULT NULL,
  payment_terms_snapshot varchar(100) DEFAULT NULL,
  payable_status enum('pending_bill','bill_received','partially_paid','paid','voided') NOT NULL DEFAULT 'pending_bill',
  notes text DEFAULT NULL,
  received_by varchar(100) DEFAULT NULL,
  received_by_name varchar(150) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY UQ_goods_receipt_notes_client_grn_number (client_id, grn_number),
  KEY IDX_goods_receipt_notes_client_branch (client_id, branch_id),
  KEY IDX_goods_receipt_notes_client_po (client_id, purchase_order_id),
  KEY IDX_goods_receipt_notes_client_payable_status (client_id, payable_status),
  KEY IDX_goods_receipt_notes_client_bill_reference (client_id, vendor_bill_reference),
  CONSTRAINT FK_goods_receipt_notes_client FOREIGN KEY (client_id) REFERENCES clients (id),
  CONSTRAINT FK_goods_receipt_notes_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT FK_goods_receipt_notes_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
  CONSTRAINT FK_goods_receipt_notes_vendor FOREIGN KEY (vendor_id) REFERENCES vendors (id)
);

CREATE TABLE IF NOT EXISTS goods_receipt_note_items (
  id int NOT NULL AUTO_INCREMENT,
  grn_id int NOT NULL,
  client_id varchar(20) NOT NULL,
  po_item_id int DEFAULT NULL,
  item_id int NOT NULL,
  ordered_quantity decimal(15,4) NOT NULL DEFAULT 0.0000,
  received_quantity decimal(15,4) NOT NULL,
  unit_cost decimal(15,4) NOT NULL DEFAULT 0.0000,
  line_total decimal(15,4) NOT NULL DEFAULT 0.0000,
  notes text DEFAULT NULL,
  PRIMARY KEY (id),
  KEY IDX_goods_receipt_note_items_grn (grn_id),
  KEY IDX_goods_receipt_note_items_client_item (client_id, item_id),
  KEY IDX_goods_receipt_note_items_po_item (po_item_id),
  CONSTRAINT FK_goods_receipt_note_items_grn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes (id) ON DELETE CASCADE,
  CONSTRAINT FK_goods_receipt_note_items_client FOREIGN KEY (client_id) REFERENCES clients (id),
  CONSTRAINT FK_goods_receipt_note_items_po_item FOREIGN KEY (po_item_id) REFERENCES purchase_order_items (id),
  CONSTRAINT FK_goods_receipt_note_items_item FOREIGN KEY (item_id) REFERENCES inventory_items (id)
);

CREATE TABLE IF NOT EXISTS accounting_payable_allocations (
  id int NOT NULL AUTO_INCREMENT,
  client_id varchar(20) NOT NULL,
  branch_id int NOT NULL,
  grn_id int NOT NULL,
  voucher_id int NOT NULL,
  journal_entry_id int DEFAULT NULL,
  vendor_id int DEFAULT NULL,
  allocated_amount decimal(15,2) NOT NULL DEFAULT 0.00,
  allocation_date date NOT NULL,
  notes text DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_accounting_payable_allocations_branch (client_id, branch_id),
  KEY IDX_accounting_payable_allocations_grn (client_id, grn_id),
  KEY IDX_accounting_payable_allocations_voucher (client_id, voucher_id),
  CONSTRAINT FK_accounting_payable_allocations_client FOREIGN KEY (client_id) REFERENCES clients (id),
  CONSTRAINT FK_accounting_payable_allocations_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT FK_accounting_payable_allocations_grn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes (id),
  CONSTRAINT FK_accounting_payable_allocations_voucher FOREIGN KEY (voucher_id) REFERENCES financial_vouchers (id),
  CONSTRAINT FK_accounting_payable_allocations_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries (id)
);

CREATE TABLE IF NOT EXISTS accounting_bank_reconciliations (
  id int NOT NULL AUTO_INCREMENT,
  client_id varchar(20) NOT NULL,
  branch_id int NOT NULL,
  account_id int NOT NULL,
  journal_entry_id int NOT NULL,
  journal_item_id int NOT NULL,
  statement_date date NOT NULL,
  statement_reference varchar(100) NOT NULL,
  statement_description varchar(255) DEFAULT NULL,
  reconciled_amount decimal(15,2) NOT NULL DEFAULT 0.00,
  notes text DEFAULT NULL,
  reconciled_by_user_id int DEFAULT NULL,
  reconciled_by_name varchar(150) DEFAULT NULL,
  reconciled_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY UQ_accounting_bank_reconciliations_journal_item (journal_item_id),
  KEY IDX_accounting_bank_reconciliations_account (client_id, branch_id, account_id),
  CONSTRAINT FK_accounting_bank_reconciliations_client FOREIGN KEY (client_id) REFERENCES clients (id),
  CONSTRAINT FK_accounting_bank_reconciliations_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
  CONSTRAINT FK_accounting_bank_reconciliations_account FOREIGN KEY (account_id) REFERENCES accounting_coa (id),
  CONSTRAINT FK_accounting_bank_reconciliations_journal_entry FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries (id),
  CONSTRAINT FK_accounting_bank_reconciliations_journal_item FOREIGN KEY (journal_item_id) REFERENCES accounting_journal_items (id)
);
