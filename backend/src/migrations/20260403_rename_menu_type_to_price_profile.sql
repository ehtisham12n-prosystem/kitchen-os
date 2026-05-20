-- Rename the main table
RENAME TABLE menu_types TO price_profiles;

-- Rename foreign key columns
ALTER TABLE products RENAME COLUMN menu_type_id TO price_profile_id;
ALTER TABLE product_branch_prices RENAME COLUMN menu_type_id TO price_profile_id;
ALTER TABLE branch_product_mapping RENAME COLUMN menu_type_id TO price_profile_id;
