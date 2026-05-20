SET @order_taker_permission := 'pos.order_taker.access';

UPDATE `users` u
JOIN `roles` cashier ON cashier.`id` = u.`role_id` AND cashier.`role_name` = 'Cashier'
JOIN `roles` pos_user ON pos_user.`client_id` = cashier.`client_id` AND pos_user.`role_name` = 'POS User'
SET u.`role_id` = pos_user.`id`
WHERE u.`role_id` = cashier.`id`;

UPDATE `user_branch_roles` ubr
JOIN `roles` cashier ON cashier.`id` = ubr.`role_id` AND cashier.`role_name` = 'Cashier'
JOIN `roles` pos_user ON pos_user.`client_id` = cashier.`client_id` AND pos_user.`role_name` = 'POS User'
SET ubr.`role_id` = pos_user.`id`
WHERE ubr.`role_id` = cashier.`id`;

UPDATE `roles` cashier
LEFT JOIN `roles` pos_user
  ON pos_user.`client_id` = cashier.`client_id`
 AND pos_user.`role_name` = 'POS User'
SET cashier.`role_name` = 'POS User'
WHERE cashier.`role_name` = 'Cashier'
  AND pos_user.`id` IS NULL;

UPDATE `roles` cashier
JOIN `roles` pos_user
  ON pos_user.`client_id` = cashier.`client_id`
 AND pos_user.`role_name` = 'POS User'
SET cashier.`is_active` = 0
WHERE cashier.`role_name` = 'Cashier';

UPDATE `roles`
SET `permissions` = JSON_ARRAY('pos.order.create', 'pos.order.read')
WHERE `role_name` = 'POS User'
  AND `is_system_role` = 1;

UPDATE `roles`
SET `permissions` = JSON_ARRAY('pos.order.create', 'pos.order.read', 'pos.order_taker.access')
WHERE `role_name` = 'Order Taker'
  AND `is_system_role` = 1;

INSERT INTO `roles` (
  `client_id`,
  `role_name`,
  `permissions`,
  `is_active`,
  `is_system_role`,
  `context_scope`,
  `approval_authority`
)
SELECT
  c.`id`,
  'Order Taker',
  JSON_ARRAY('pos.order.create', 'pos.order.read', 'pos.order_taker.access'),
  1,
  1,
  'branch',
  'none'
FROM `clients` c
WHERE NOT EXISTS (
  SELECT 1
  FROM `roles` r
  WHERE r.`client_id` = c.`id`
    AND r.`role_name` = 'Order Taker'
);
