ALTER TABLE clients
    ADD INDEX idx_clients_onboarding_blueprint (onboarding_blueprint);

ALTER TABLE departments
    ADD INDEX idx_departments_client_code (client_id, code);

ALTER TABLE designations
    ADD INDEX idx_designations_client_code (client_id, code);

ALTER TABLE categories
    ADD INDEX idx_categories_client_name (client_id, category_name);

ALTER TABLE menu_types
    ADD INDEX idx_menu_types_client_name (client_id, name);

ALTER TABLE cuisine_types
    ADD INDEX idx_cuisine_types_client_name (client_id, name);

ALTER TABLE stations
    ADD INDEX idx_stations_client_name (client_id, name);

ALTER TABLE uoms
    ADD INDEX idx_uoms_client_abbreviation (client_id, abbreviation);

ALTER TABLE accounting_coa
    ADD INDEX idx_accounting_coa_client_parent (client_id, parent_id);
