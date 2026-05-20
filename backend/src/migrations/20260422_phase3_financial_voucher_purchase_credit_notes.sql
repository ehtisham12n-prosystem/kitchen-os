ALTER TABLE financial_vouchers
  MODIFY COLUMN type ENUM('EXPENSE', 'PAYMENT', 'COMPENSATION', 'PURCHASE_CREDIT_NOTE') NOT NULL DEFAULT 'EXPENSE';

ALTER TABLE financial_vouchers
  ADD COLUMN linked_grn_id INT NULL AFTER payment_source_label;

ALTER TABLE financial_vouchers
  ADD INDEX idx_financial_vouchers_client_linked_grn (client_id, linked_grn_id);

ALTER TABLE financial_vouchers
  ADD CONSTRAINT fk_financial_vouchers_linked_grn
    FOREIGN KEY (linked_grn_id) REFERENCES goods_receipt_notes(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
