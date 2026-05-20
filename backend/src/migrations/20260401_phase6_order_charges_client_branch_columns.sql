ALTER TABLE `order_charges`
  ADD COLUMN `client_id` varchar(20) NULL AFTER `order_id`,
  ADD COLUMN `branch_id` int NULL AFTER `client_id`;

UPDATE `order_charges` charge
INNER JOIN `orders` ord ON ord.id = charge.order_id
SET
  charge.client_id = ord.client_id,
  charge.branch_id = ord.branch_id
WHERE charge.client_id IS NULL
   OR charge.branch_id IS NULL;

ALTER TABLE `order_charges`
  MODIFY COLUMN `client_id` varchar(20) NOT NULL,
  ADD KEY `IDX_order_charges_client_id` (`client_id`),
  ADD KEY `IDX_order_charges_branch_id` (`branch_id`);
