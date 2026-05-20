UPDATE `branches`
SET `branch_code` = UPPER(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(TRIM(`branch_code`), '-', ''),
      ' ', ''),
    '/', ''),
  '_', '')
)
WHERE `branch_code` IS NOT NULL
  AND `branch_code` <> UPPER(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(TRIM(`branch_code`), '-', ''),
        ' ', ''),
      '/', ''),
    '_', '')
  );
