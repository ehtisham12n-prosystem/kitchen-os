ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `management_pin` VARCHAR(10) NULL AFTER `user_password_hash`,
  ADD COLUMN IF NOT EXISTS `pos_approval_pin` VARCHAR(10) NULL AFTER `management_pin`,
  ADD COLUMN IF NOT EXISTS `pos_user_pin` VARCHAR(10) NULL AFTER `pos_approval_pin`;

SET @has_pos_close_pin = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'pos_close_pin'
);

SET @has_user_pin_code = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'user_pin_code'
);

SET @has_pos_cancel_pin = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'pos_cancel_pin'
);

SET @has_pos_return_pin = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'pos_return_pin'
);

SET @management_source = TRIM(BOTH ', ' FROM CONCAT(
  'NULLIF(`management_pin`, '''')',
  IF(@has_pos_close_pin > 0, ', NULLIF(`pos_close_pin`, '''')', ''),
  IF(@has_user_pin_code > 0, ', NULLIF(`user_pin_code`, '''')', '')
));

SET @management_where = TRIM(BOTH ' ' FROM CONCAT(
  IF(@has_pos_close_pin > 0, '(`pos_close_pin` IS NOT NULL AND `pos_close_pin` <> '''')', ''),
  IF(@has_pos_close_pin > 0 AND @has_user_pin_code > 0, ' OR ', ''),
  IF(@has_user_pin_code > 0, '(`user_pin_code` IS NOT NULL AND `user_pin_code` <> '''')', '')
));

SET @management_sql = IF(
  @management_where = '',
  'SELECT 1',
  CONCAT(
    'UPDATE `users` ',
    'SET `management_pin` = COALESCE(', @management_source, ') ',
    'WHERE (`management_pin` IS NULL OR `management_pin` = '''') ',
    'AND (', @management_where, ')'
  )
);
PREPARE users_management_pin FROM @management_sql;
EXECUTE users_management_pin;
DEALLOCATE PREPARE users_management_pin;

SET @approval_source = TRIM(BOTH ', ' FROM CONCAT(
  'NULLIF(`pos_approval_pin`, '''')',
  IF(@has_pos_cancel_pin > 0, ', NULLIF(`pos_cancel_pin`, '''')', ''),
  IF(@has_pos_return_pin > 0, ', NULLIF(`pos_return_pin`, '''')', ''),
  IF(@has_user_pin_code > 0, ', NULLIF(`user_pin_code`, '''')', '')
));

SET @approval_where = TRIM(BOTH ' ' FROM CONCAT(
  IF(@has_pos_cancel_pin > 0, '(`pos_cancel_pin` IS NOT NULL AND `pos_cancel_pin` <> '''')', ''),
  IF((@has_pos_cancel_pin + @has_pos_return_pin > 0) AND @has_user_pin_code > 0, ' OR ', IF(@has_pos_cancel_pin > 0 AND @has_pos_return_pin > 0, ' OR ', '')),
  IF(@has_pos_return_pin > 0, '(`pos_return_pin` IS NOT NULL AND `pos_return_pin` <> '''')', ''),
  IF((@has_pos_cancel_pin > 0 OR @has_pos_return_pin > 0) AND @has_user_pin_code > 0, ' OR ', ''),
  IF(@has_user_pin_code > 0, '(`user_pin_code` IS NOT NULL AND `user_pin_code` <> '''')', '')
));

SET @approval_sql = IF(
  @approval_where = '',
  'SELECT 1',
  CONCAT(
    'UPDATE `users` ',
    'SET `pos_approval_pin` = COALESCE(', @approval_source, ') ',
    'WHERE (`pos_approval_pin` IS NULL OR `pos_approval_pin` = '''') ',
    'AND (', @approval_where, ')'
  )
);
PREPARE users_approval_pin FROM @approval_sql;
EXECUTE users_approval_pin;
DEALLOCATE PREPARE users_approval_pin;

SET @user_source = TRIM(BOTH ', ' FROM CONCAT(
  'NULLIF(`pos_user_pin`, '''')',
  IF(@has_user_pin_code > 0, ', NULLIF(`user_pin_code`, '''')', ''),
  IF(@has_pos_close_pin > 0, ', NULLIF(`pos_close_pin`, '''')', '')
));

SET @user_where = TRIM(BOTH ' ' FROM CONCAT(
  IF(@has_user_pin_code > 0, '(`user_pin_code` IS NOT NULL AND `user_pin_code` <> '''')', ''),
  IF(@has_user_pin_code > 0 AND @has_pos_close_pin > 0, ' OR ', ''),
  IF(@has_pos_close_pin > 0, '(`pos_close_pin` IS NOT NULL AND `pos_close_pin` <> '''')', '')
));

SET @user_sql = IF(
  @user_where = '',
  'SELECT 1',
  CONCAT(
    'UPDATE `users` ',
    'SET `pos_user_pin` = COALESCE(', @user_source, ') ',
    'WHERE (`pos_user_pin` IS NULL OR `pos_user_pin` = '''') ',
    'AND (', @user_where, ')'
  )
);
PREPARE users_pos_pin FROM @user_sql;
EXECUTE users_pos_pin;
DEALLOCATE PREPARE users_pos_pin;

ALTER TABLE `users`
  DROP COLUMN IF EXISTS `user_pin_code`,
  DROP COLUMN IF EXISTS `pos_return_pin`,
  DROP COLUMN IF EXISTS `pos_cancel_pin`,
  DROP COLUMN IF EXISTS `pos_close_pin`;
