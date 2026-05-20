ALTER TABLE catering_event_settlements
  ADD COLUMN settlement_type ENUM('advance', 'collection') NOT NULL DEFAULT 'collection' AFTER payment_mode;
