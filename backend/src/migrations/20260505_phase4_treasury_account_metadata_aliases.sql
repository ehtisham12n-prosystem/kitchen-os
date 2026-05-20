ALTER TABLE `accounting_coa`
  ADD COLUMN IF NOT EXISTS `treasury_institution_name` varchar(150) DEFAULT NULL AFTER `bank_name`,
  ADD COLUMN IF NOT EXISTS `treasury_account_title` varchar(150) DEFAULT NULL AFTER `account_title`,
  ADD COLUMN IF NOT EXISTS `treasury_reference_no_iban` varchar(60) DEFAULT NULL AFTER `account_number_iban`,
  ADD COLUMN IF NOT EXISTS `treasury_currency_code` varchar(10) DEFAULT NULL AFTER `currency_code`,
  ADD COLUMN IF NOT EXISTS `treasury_account_type` varchar(20) DEFAULT NULL AFTER `bank_account_type`;

UPDATE `accounting_coa`
SET
  `treasury_institution_name` = COALESCE(NULLIF(`treasury_institution_name`, ''), `bank_name`),
  `treasury_account_title` = COALESCE(NULLIF(`treasury_account_title`, ''), `account_title`),
  `treasury_reference_no_iban` = COALESCE(NULLIF(`treasury_reference_no_iban`, ''), `account_number_iban`),
  `treasury_currency_code` = COALESCE(NULLIF(`treasury_currency_code`, ''), `currency_code`),
  `treasury_account_type` = COALESCE(NULLIF(`treasury_account_type`, ''), `bank_account_type`)
WHERE
  `bank_name` IS NOT NULL
  OR `account_title` IS NOT NULL
  OR `account_number_iban` IS NOT NULL
  OR `currency_code` IS NOT NULL
  OR `bank_account_type` IS NOT NULL;

UPDATE `accounting_coa`
SET
  `bank_name` = COALESCE(NULLIF(`bank_name`, ''), `treasury_institution_name`),
  `account_title` = COALESCE(NULLIF(`account_title`, ''), `treasury_account_title`),
  `account_number_iban` = COALESCE(NULLIF(`account_number_iban`, ''), `treasury_reference_no_iban`),
  `currency_code` = COALESCE(NULLIF(`currency_code`, ''), `treasury_currency_code`),
  `bank_account_type` = COALESCE(NULLIF(`bank_account_type`, ''), `treasury_account_type`)
WHERE
  `treasury_institution_name` IS NOT NULL
  OR `treasury_account_title` IS NOT NULL
  OR `treasury_reference_no_iban` IS NOT NULL
  OR `treasury_currency_code` IS NOT NULL
  OR `treasury_account_type` IS NOT NULL;
