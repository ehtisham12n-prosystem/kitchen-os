ALTER TABLE `products`
  ADD COLUMN `distribution_scope` enum('all','selected') NOT NULL DEFAULT 'all' AFTER `is_branch_active`;

CREATE INDEX `IDX_products_client_distribution_scope`
  ON `products` (`client_id`, `distribution_scope`);
