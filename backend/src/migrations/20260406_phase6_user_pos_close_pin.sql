ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pos_close_pin VARCHAR(10) NULL AFTER pos_cancel_pin;

UPDATE users
SET pos_close_pin = user_pin_code
WHERE (pos_close_pin IS NULL OR pos_close_pin = '')
  AND user_pin_code IS NOT NULL
  AND user_pin_code <> '';
