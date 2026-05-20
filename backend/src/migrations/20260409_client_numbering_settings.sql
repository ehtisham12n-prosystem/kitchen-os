ALTER TABLE `client_settings`
  ADD COLUMN `numbering_settings` json NULL AFTER `station_printer_mapping`;
