# DB Schema Change Log

Keep this file updated whenever a commit introduces, changes, or removes database schema objects. Each entry must include the commit hash, migration file, affected tables, and live deployment SQL/instructions.

## 2026-05-26 17:53:25 +05:00

- Commit: `fadeedbc71e3ddf1e70a90657de1d53c46aee28b`
- Branch: `main`
- Migration File: `backend/src/migrations/20260525_phase2_grn_purchase_source_and_payment_status.sql`
- Affected Table: `goods_receipt_notes`
- Purpose: Support PO-based and non-PO/direct-purchase GRNs with payment status tracking.

### Columns Added

- `purchase_source_type`
- `payment_status`
- `paid_amount`
- `outstanding_amount`
- `payment_method`
- `payment_reference`
- `payment_date`
- `payment_source`

### Live Deployment SQL

```sql
ALTER TABLE goods_receipt_notes
  ADD COLUMN purchase_source_type ENUM('PO', 'NON_PO') NOT NULL DEFAULT 'PO' AFTER po_id,
  ADD COLUMN payment_status ENUM('PAID', 'PARTIAL_PAID', 'CREDIT') NOT NULL DEFAULT 'CREDIT' AFTER payable_status,
  ADD COLUMN paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER payment_status,
  ADD COLUMN outstanding_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER paid_amount,
  ADD COLUMN payment_method VARCHAR(100) NULL AFTER outstanding_amount,
  ADD COLUMN payment_reference VARCHAR(255) NULL AFTER payment_method,
  ADD COLUMN payment_date DATE NULL AFTER payment_reference,
  ADD COLUMN payment_source VARCHAR(100) NULL AFTER payment_date;
```

### Deployment Notes

- Apply this migration before deploying the backend/frontend build that reads these columns.
- If this migration is missing on live, GRN list/detail pages can fail with `Unknown column 'grn.purchase_source_type' in 'field list'`.
- After deployment, verify `GET /v1/inventory-op/grns` returns `200`.

## 2026-05-31 19:55:27 +05:00

- Branch: `main`
- Commit Message: `Improve access UI and dense asset register`
- Migration File: None
- Affected Tables: None
- Purpose: Record that this commit contains UI/access-display changes only.

### DB Schema Changes

No database schema changes were introduced in this commit. No live DB migration is required.
