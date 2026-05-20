ALTER TABLE `inventory_transfers`
  MODIFY COLUMN `status` enum('requested','approved','rejected','cancelled','in_transit','received','received_with_variance') NOT NULL DEFAULT 'requested',
  ADD COLUMN `cancelled_by` varchar(100) NULL AFTER `rejection_notes`,
  ADD COLUMN `cancelled_by_name` varchar(150) NULL AFTER `cancelled_by`,
  ADD COLUMN `cancelled_at` datetime NULL AFTER `cancelled_by_name`,
  ADD COLUMN `cancellation_notes` text NULL AFTER `cancelled_at`;

ALTER TABLE `inventory_transfer_events`
  MODIFY COLUMN `action` enum('requested','approved','rejected','cancelled','dispatched','received') NOT NULL;
