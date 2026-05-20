ALTER TABLE `procurement_requests`
  ADD COLUMN `procurement_context` enum('branch_procurement','branch_requisition','central_procurement') NOT NULL DEFAULT 'branch_procurement' AFTER `procurement_mode`,
  ADD COLUMN `approval_scope` enum('branch','central') NOT NULL DEFAULT 'branch' AFTER `procurement_context`;

UPDATE `procurement_requests`
SET `procurement_context` = CASE
  WHEN `requesting_branch_id` = `destination_branch_id` THEN 'branch_procurement'
  ELSE 'branch_requisition'
END
WHERE `procurement_context` IS NULL OR `procurement_context` = '';

UPDATE `procurement_requests`
SET `approval_scope` = CASE
  WHEN `procurement_context` = 'branch_procurement' THEN 'branch'
  ELSE 'central'
END
WHERE `approval_scope` IS NULL OR `approval_scope` = '';

ALTER TABLE `purchase_orders`
  ADD COLUMN `procurement_context` enum('branch_procurement','branch_requisition','central_procurement') NOT NULL DEFAULT 'branch_procurement' AFTER `procurement_mode`,
  ADD COLUMN `approval_scope` enum('branch','central') NOT NULL DEFAULT 'branch' AFTER `procurement_context`;

UPDATE `purchase_orders`
SET `procurement_context` = CASE
  WHEN `branch_id` = `destination_branch_id` THEN 'branch_procurement'
  ELSE 'branch_requisition'
END
WHERE `procurement_context` IS NULL OR `procurement_context` = '';

UPDATE `purchase_orders` po
INNER JOIN `branches` source_branch ON source_branch.`id` = po.`branch_id`
SET po.`procurement_context` = 'central_procurement'
WHERE source_branch.`inventory_store_type` = 'central';

UPDATE `purchase_orders`
SET `approval_scope` = CASE
  WHEN `procurement_context` = 'branch_procurement' THEN 'branch'
  ELSE 'central'
END
WHERE `approval_scope` IS NULL OR `approval_scope` = '';
