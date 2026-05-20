ALTER TABLE `products`
  ADD COLUMN `allow_open_order_return` boolean NOT NULL DEFAULT false AFTER `is_branch_active`;

ALTER TABLE `branch_product_mapping`
  ADD COLUMN `allow_open_order_return` boolean NULL AFTER `temporary_disable_reason`;
