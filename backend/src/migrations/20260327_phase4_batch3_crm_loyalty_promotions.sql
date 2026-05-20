ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `customer_code` varchar(40) NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `date_of_birth` date NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `anniversary_date` date NULL AFTER `date_of_birth`,
  ADD COLUMN IF NOT EXISTS `gender` enum('male','female','other','prefer_not_to_say') NULL AFTER `anniversary_date`,
  ADD COLUMN IF NOT EXISTS `preferred_branch_id` int NULL AFTER `gender`,
  ADD COLUMN IF NOT EXISTS `address_line_1` varchar(255) NULL AFTER `preferred_branch_id`,
  ADD COLUMN IF NOT EXISTS `address_line_2` varchar(255) NULL AFTER `address_line_1`,
  ADD COLUMN IF NOT EXISTS `city` varchar(100) NULL AFTER `address_line_2`,
  ADD COLUMN IF NOT EXISTS `notes` text NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `marketing_opt_in` tinyint(1) NOT NULL DEFAULT 0 AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `loyalty_points_lifetime` int NOT NULL DEFAULT 0 AFTER `loyalty_points`,
  ADD COLUMN IF NOT EXISTS `last_visit_at` datetime NULL AFTER `loyalty_points_lifetime`,
  ADD COLUMN IF NOT EXISTS `last_order_at` datetime NULL AFTER `last_visit_at`,
  ADD COLUMN IF NOT EXISTS `total_orders` int NOT NULL DEFAULT 0 AFTER `last_order_at`,
  ADD COLUMN IF NOT EXISTS `total_spent` decimal(12,2) NOT NULL DEFAULT 0.00 AFTER `total_orders`,
  ADD COLUMN IF NOT EXISTS `average_order_value` decimal(12,2) NOT NULL DEFAULT 0.00 AFTER `total_spent`,
  ADD KEY `IDX_customers_client_status` (`client_id`, `status`),
  ADD KEY `IDX_customers_preferred_branch` (`preferred_branch_id`);

ALTER TABLE `customers`
  ADD CONSTRAINT `FK_customers_preferred_branch`
    FOREIGN KEY (`preferred_branch_id`) REFERENCES `branches` (`id`);

ALTER TABLE `deals_vouchers`
  ADD COLUMN IF NOT EXISTS `name` varchar(120) NULL AFTER `code`,
  ADD COLUMN IF NOT EXISTS `description` text NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `applicable_order_types` json NULL AFTER `branch_availability`,
  ADD COLUMN IF NOT EXISTS `customer_required` tinyint(1) NOT NULL DEFAULT 0 AFTER `applicable_order_types`,
  ADD COLUMN IF NOT EXISTS `per_customer_limit` int NULL AFTER `customer_required`,
  ADD COLUMN IF NOT EXISTS `first_order_only` tinyint(1) NOT NULL DEFAULT 0 AFTER `per_customer_limit`,
  ADD KEY `IDX_deals_vouchers_client_active` (`client_id`, `is_active`);

CREATE TABLE IF NOT EXISTS `customer_loyalty_ledger` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int DEFAULT NULL,
  `customer_id` int NOT NULL,
  `source_order_id` int DEFAULT NULL,
  `event_type` enum('earn','redeem','adjust','expire','reverse') NOT NULL,
  `points_delta` int NOT NULL,
  `balance_after` int NOT NULL DEFAULT 0,
  `remarks` varchar(255) DEFAULT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_customer_loyalty_ledger_customer` (`client_id`, `customer_id`, `created_at`),
  KEY `IDX_customer_loyalty_ledger_order` (`client_id`, `source_order_id`, `event_type`),
  CONSTRAINT `FK_customer_loyalty_ledger_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_customer_loyalty_ledger_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_customer_loyalty_ledger_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `FK_customer_loyalty_ledger_order` FOREIGN KEY (`source_order_id`) REFERENCES `orders` (`id`)
);

CREATE TABLE IF NOT EXISTS `deal_voucher_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(20) NOT NULL,
  `branch_id` int NOT NULL,
  `voucher_id` int NOT NULL,
  `order_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `voucher_code` varchar(50) NOT NULL,
  `sub_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `redeemed_by_user_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_deal_voucher_redemptions_order` (`client_id`, `order_id`),
  KEY `IDX_deal_voucher_redemptions_voucher` (`client_id`, `voucher_id`, `created_at`),
  CONSTRAINT `FK_deal_voucher_redemptions_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `FK_deal_voucher_redemptions_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `FK_deal_voucher_redemptions_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `deals_vouchers` (`id`),
  CONSTRAINT `FK_deal_voucher_redemptions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `FK_deal_voucher_redemptions_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
);
