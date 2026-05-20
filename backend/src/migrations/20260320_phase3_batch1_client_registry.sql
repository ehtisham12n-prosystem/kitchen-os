ALTER TABLE clients
  ADD COLUMN client_code VARCHAR(30) NULL AFTER id,
  ADD COLUMN legal_name VARCHAR(150) NULL AFTER client_name;

ALTER TABLE clients
  MODIFY COLUMN client_status ENUM(
    'draft',
    'onboarding',
    'active',
    'suspended',
    'inactive',
    'closed',
    'expired_grace',
    'read_only'
  ) NOT NULL DEFAULT 'draft';

CREATE UNIQUE INDEX ux_clients_client_code ON clients (client_code);

CREATE TABLE client_contacts (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  contact_type ENUM('business_primary', 'billing_primary', 'operations_primary') NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  designation VARCHAR(100) NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(50) NULL,
  alternate_phone VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_client_contacts_role (client_id, contact_type),
  CONSTRAINT fk_client_contacts_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON DELETE CASCADE
);

CREATE TABLE client_status_history (
  id INT NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(20) NOT NULL,
  from_status ENUM(
    'draft',
    'onboarding',
    'active',
    'suspended',
    'inactive',
    'closed',
    'expired_grace',
    'read_only'
  ) NULL,
  to_status ENUM(
    'draft',
    'onboarding',
    'active',
    'suspended',
    'inactive',
    'closed',
    'expired_grace',
    'read_only'
  ) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  changed_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_client_status_history_client_created (client_id, created_at),
  CONSTRAINT fk_client_status_history_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON DELETE CASCADE
);
