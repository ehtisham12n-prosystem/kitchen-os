ALTER TABLE `orders`
  ADD COLUMN `delivery_details` JSON NULL AFTER `order_note`;
