ALTER TABLE `client_settings`
  ADD COLUMN `kot_print_enabled` tinyint(1) NOT NULL DEFAULT 1 AFTER `kot_print_copies`,
  ADD COLUMN `separate_kot_stations` json NULL AFTER `station_printer_mapping`;
