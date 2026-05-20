UPDATE `uoms`
SET `abbreviation` = UPPER(TRIM(`abbreviation`))
WHERE `abbreviation` IS NOT NULL
  AND `abbreviation` <> UPPER(TRIM(`abbreviation`));
