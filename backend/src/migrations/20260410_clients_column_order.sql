ALTER TABLE `clients`
  MODIFY COLUMN `client_code` varchar(30) NOT NULL AFTER `id`,
  MODIFY COLUMN `legal_name` varchar(150) NULL AFTER `client_code`,
  MODIFY COLUMN `legacy_client_ref` varchar(20) NOT NULL AFTER `legal_name`;
