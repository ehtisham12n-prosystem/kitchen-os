ALTER TABLE `roles`
  ADD COLUMN `context_scope` enum('branch','central','hybrid') NOT NULL DEFAULT 'hybrid' AFTER `description`,
  ADD COLUMN `approval_authority` enum('none','branch','central','both') NULL AFTER `context_scope`;

ALTER TABLE `user_branch_roles`
  ADD COLUMN `assignment_scope` enum('branch','central') NULL AFTER `role_id`,
  ADD COLUMN `approval_authority` enum('none','branch','central','both') NULL AFTER `assignment_scope`;

UPDATE `roles`
SET
  `context_scope` = 'central',
  `approval_authority` = 'both'
WHERE `role_name` = 'Client Admin';

UPDATE `roles`
SET
  `context_scope` = 'branch',
  `approval_authority` = 'branch'
WHERE `role_name` = 'Branch Manager';

UPDATE `roles`
SET
  `context_scope` = 'branch',
  `approval_authority` = 'none'
WHERE `role_name` IN ('Cashier', 'Inventory Clerk');

UPDATE `roles`
SET
  `context_scope` = 'hybrid',
  `approval_authority` = 'none'
WHERE `role_name` = 'Accountant';

UPDATE `user_branch_roles` AS `ubr`
INNER JOIN `branches` AS `b`
  ON `b`.`id` = `ubr`.`branch_id`
SET `ubr`.`assignment_scope` = CASE
  WHEN `b`.`inventory_store_type` = 'central' THEN 'central'
  ELSE 'branch'
END
WHERE `ubr`.`assignment_scope` IS NULL;
