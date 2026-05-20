ALTER TABLE `accounting_coa`
  ADD COLUMN `is_system` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_cash_account`;

UPDATE `accounting_coa`
SET `is_system` = 1
WHERE `account_code` IN (
  '1000','1100','1101','1102','1200','1210','1300','1400',
  '2000','2100','2110','2300','2301','2302',
  '3000','3100','3200',
  '4000','4100','4200','4300','4400','4500',
  '5000','5100','5200','5300','5400','5500','5600','5800'
);
