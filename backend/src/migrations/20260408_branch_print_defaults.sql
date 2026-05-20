ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS date_format VARCHAR(30) NOT NULL DEFAULT 'MMM DD, YYYY' AFTER currency_code,
    ADD COLUMN IF NOT EXISTS time_format VARCHAR(30) NOT NULL DEFAULT 'hh:mma' AFTER date_format;

UPDATE branches
SET
    inherit_client_currency = 0,
    currency_code = UPPER(COALESCE(NULLIF(currency_code, ''), 'USD')),
    date_format = COALESCE(NULLIF(date_format, ''), 'MMM DD, YYYY'),
    time_format = COALESCE(NULLIF(time_format, ''), 'hh:mma');

ALTER TABLE client_settings
    ADD COLUMN IF NOT EXISTS receipt_paper_size VARCHAR(20) NOT NULL DEFAULT 'thermal-80mm' AFTER show_header_short_logo,
    ADD COLUMN IF NOT EXISTS invoice_paper_size VARCHAR(20) NOT NULL DEFAULT 'a4' AFTER receipt_paper_size,
    ADD COLUMN IF NOT EXISTS kot_paper_size VARCHAR(20) NOT NULL DEFAULT 'thermal-80mm' AFTER invoice_paper_size,
    ADD COLUMN IF NOT EXISTS report_paper_size VARCHAR(20) NOT NULL DEFAULT 'a4' AFTER kot_paper_size,
    ADD COLUMN IF NOT EXISTS receipt_print_copies INT NOT NULL DEFAULT 1 AFTER report_paper_size,
    ADD COLUMN IF NOT EXISTS invoice_print_copies INT NOT NULL DEFAULT 1 AFTER receipt_print_copies,
    ADD COLUMN IF NOT EXISTS kot_print_copies INT NOT NULL DEFAULT 1 AFTER invoice_print_copies,
    ADD COLUMN IF NOT EXISTS report_print_copies INT NOT NULL DEFAULT 1 AFTER kot_print_copies,
    ADD COLUMN IF NOT EXISTS order_change_print_mode VARCHAR(20) NOT NULL DEFAULT 'change_only' AFTER report_print_copies,
    ADD COLUMN IF NOT EXISTS order_change_print_copies INT NOT NULL DEFAULT 1 AFTER order_change_print_mode,
    ADD COLUMN IF NOT EXISTS enable_station_wise_kot_printing TINYINT(1) NOT NULL DEFAULT 0 AFTER order_change_print_copies,
    ADD COLUMN IF NOT EXISTS allow_multiple_kot_per_station TINYINT(1) NOT NULL DEFAULT 0 AFTER enable_station_wise_kot_printing,
    ADD COLUMN IF NOT EXISTS service_station_print_copies JSON NULL AFTER allow_multiple_kot_per_station,
    ADD COLUMN IF NOT EXISTS station_printer_mapping JSON NULL AFTER service_station_print_copies;
