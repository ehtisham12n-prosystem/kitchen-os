ALTER TABLE `categories`
  ADD COLUMN `is_active` boolean NOT NULL DEFAULT true AFTER `branch_availability`,
  ADD KEY `IDX_categories_client_is_active` (`client_id`, `is_active`);

ALTER TABLE `inventory_classes`
  ADD COLUMN `is_active` boolean NOT NULL DEFAULT true AFTER `class_description`,
  ADD KEY `IDX_inventory_classes_client_is_active` (`client_id`, `is_active`);

ALTER TABLE `inventory_types`
  ADD COLUMN `is_active` boolean NOT NULL DEFAULT true AFTER `type_name`,
  ADD KEY `IDX_inventory_types_client_is_active` (`client_id`, `is_active`);

ALTER TABLE `inventory_sub_types`
  ADD COLUMN `is_active` boolean NOT NULL DEFAULT true AFTER `allow_issuance`,
  ADD KEY `IDX_inventory_sub_types_client_is_active` (`client_id`, `is_active`);

ALTER TABLE `roles`
  ADD COLUMN `is_active` boolean NOT NULL DEFAULT true AFTER `is_system_role`,
  ADD KEY `IDX_roles_client_is_active` (`client_id`, `is_active`);
