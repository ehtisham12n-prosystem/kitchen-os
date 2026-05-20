START TRANSACTION;

UPDATE `clients`
SET `client_code` = CASE
  WHEN UPPER(TRIM(`id`)) = 'NX-10101' THEN 'NX-10101'
  WHEN UPPER(REPLACE(TRIM(`id`), '-', '')) REGEXP '^CL[0-9]+$' THEN UPPER(REPLACE(TRIM(`id`), '-', ''))
  WHEN `client_code` IS NOT NULL AND TRIM(`client_code`) <> '' THEN UPPER(REPLACE(TRIM(`client_code`), '-', ''))
  ELSE UPPER(REPLACE(TRIM(`id`), '-', ''))
END;

SET SESSION group_concat_max_len = 1000000;

SELECT GROUP_CONCAT(
  CONCAT(
    'ALTER TABLE `', kcu.TABLE_NAME, '` DROP FOREIGN KEY `', kcu.CONSTRAINT_NAME, '`'
  )
  SEPARATOR '; '
) INTO @drop_client_fk_sql
FROM information_schema.KEY_COLUMN_USAGE kcu
WHERE kcu.TABLE_SCHEMA = DATABASE()
  AND kcu.REFERENCED_TABLE_NAME = 'clients'
  AND kcu.REFERENCED_COLUMN_NAME = 'id'
  AND kcu.TABLE_NAME <> 'clients';

SET @drop_client_fk_sql = IFNULL(@drop_client_fk_sql, 'SELECT 1');
PREPARE drop_client_fks FROM @drop_client_fk_sql;
EXECUTE drop_client_fks;
DEALLOCATE PREPARE drop_client_fks;

SELECT GROUP_CONCAT(
  CONCAT(
    'UPDATE `', c.TABLE_NAME, '` t ',
    'JOIN `clients` cli ON t.`client_id` = cli.`id` ',
    'SET t.`client_id` = cli.`client_code`'
  )
  SEPARATOR '; '
) INTO @rewrite_client_ids_sql
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.COLUMN_NAME = 'client_id'
  AND c.TABLE_NAME <> 'clients';

SET @rewrite_client_ids_sql = IFNULL(@rewrite_client_ids_sql, 'SELECT 1');
PREPARE rewrite_client_ids FROM @rewrite_client_ids_sql;
EXECUTE rewrite_client_ids;
DEALLOCATE PREPARE rewrite_client_ids;

ALTER TABLE `clients`
  ADD COLUMN `new_id` INT NOT NULL AUTO_INCREMENT UNIQUE FIRST;

ALTER TABLE `clients`
  DROP PRIMARY KEY;

ALTER TABLE `clients`
  CHANGE COLUMN `id` `legacy_client_ref` VARCHAR(20) NOT NULL;

ALTER TABLE `clients`
  CHANGE COLUMN `new_id` `id` INT NOT NULL AUTO_INCREMENT;

ALTER TABLE `clients`
  MODIFY COLUMN `client_code` VARCHAR(30) NOT NULL;

ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`);

SELECT GROUP_CONCAT(
  CONCAT(
    'ALTER TABLE `', c.TABLE_NAME, '` ',
    'ADD CONSTRAINT `FK_', c.TABLE_NAME, '_client_code` ',
    'FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_code`)'
  )
  SEPARATOR '; '
) INTO @recreate_client_fk_sql
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.COLUMN_NAME = 'client_id'
  AND c.TABLE_NAME <> 'clients';

SET @recreate_client_fk_sql = IFNULL(@recreate_client_fk_sql, 'SELECT 1');
PREPARE recreate_client_fks FROM @recreate_client_fk_sql;
EXECUTE recreate_client_fks;
DEALLOCATE PREPARE recreate_client_fks;

COMMIT;
