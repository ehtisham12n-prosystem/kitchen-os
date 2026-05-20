SET @tax_registration_number_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tax_configurations'
    AND COLUMN_NAME = 'tax_registration_number'
);
SET @payment_type_rates_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tax_configurations'
    AND COLUMN_NAME = 'payment_type_rates'
);

SET @sql_tax_registration_number := IF(
  @tax_registration_number_exists = 0,
  'ALTER TABLE `tax_configurations` ADD COLUMN `tax_registration_number` varchar(100) NULL AFTER `tax_code`',
  'SELECT 1'
);
PREPARE stmt_tax_registration_number FROM @sql_tax_registration_number;
EXECUTE stmt_tax_registration_number;
DEALLOCATE PREPARE stmt_tax_registration_number;

SET @sql_payment_type_rates := IF(
  @payment_type_rates_exists = 0,
  'ALTER TABLE `tax_configurations` ADD COLUMN `payment_type_rates` json NULL AFTER `tax_rate`',
  'SELECT 1'
);
PREPARE stmt_payment_type_rates FROM @sql_payment_type_rates;
EXECUTE stmt_payment_type_rates;
DEALLOCATE PREPARE stmt_payment_type_rates;
