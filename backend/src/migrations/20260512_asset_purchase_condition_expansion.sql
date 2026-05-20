ALTER TABLE `accounting_fixed_asset_units`
  MODIFY COLUMN `purchase_condition` enum(
    'new',
    'open_box',
    'used_working',
    'used_excellent',
    'used_good',
    'used_fair',
    'used_poor',
    'refurbished'
  ) NOT NULL DEFAULT 'new';

