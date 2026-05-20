CREATE TABLE IF NOT EXISTS blueprints (
    id CHAR(36) NOT NULL PRIMARY KEY,
    blueprint_code VARCHAR(60) NOT NULL,
    blueprint_name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    blueprint_status ENUM('draft','active','retired') NOT NULL DEFAULT 'draft',
    active_version_id INT NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_blueprints_code (blueprint_code),
    KEY idx_blueprints_status (blueprint_status),
    KEY idx_blueprints_active_version (active_version_id)
);

CREATE TABLE IF NOT EXISTS blueprint_versions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    blueprint_id CHAR(36) NOT NULL,
    version_no INT NOT NULL,
    payload_json LONGTEXT NOT NULL,
    schema_version VARCHAR(20) NOT NULL DEFAULT 'v1',
    release_notes TEXT NULL,
    created_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_blueprint_versions_blueprint_version (blueprint_id, version_no),
    KEY idx_blueprint_versions_blueprint (blueprint_id),
    CONSTRAINT fk_blueprint_versions_blueprint FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS client_blueprint_assignments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(20) NOT NULL,
    onboarding_id INT NULL,
    blueprint_id CHAR(36) NOT NULL,
    blueprint_version_id INT NOT NULL,
    assignment_status ENUM('assigned','applied','failed') NOT NULL DEFAULT 'assigned',
    assigned_by VARCHAR(255) NULL,
    applied_by VARCHAR(255) NULL,
    applied_at DATETIME NULL,
    failure_summary TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_client_blueprint_assignments_client_created (client_id, created_at),
    KEY idx_client_blueprint_assignments_onboarding (onboarding_id),
    KEY idx_client_blueprint_assignments_blueprint (blueprint_id),
    KEY idx_client_blueprint_assignments_version (blueprint_version_id),
    CONSTRAINT fk_client_blueprint_assignments_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_client_blueprint_assignments_onboarding FOREIGN KEY (onboarding_id) REFERENCES client_onboardings(id) ON DELETE CASCADE,
    CONSTRAINT fk_client_blueprint_assignments_blueprint FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE,
    CONSTRAINT fk_client_blueprint_assignments_version FOREIGN KEY (blueprint_version_id) REFERENCES blueprint_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blueprint_application_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    client_id VARCHAR(20) NOT NULL,
    onboarding_id INT NULL,
    blueprint_id CHAR(36) NOT NULL,
    blueprint_version_id INT NOT NULL,
    section_key VARCHAR(50) NOT NULL,
    result_status ENUM('success','skipped','failed') NOT NULL DEFAULT 'success',
    message VARCHAR(255) NOT NULL,
    details_json LONGTEXT NULL,
    executed_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_blueprint_application_logs_assignment_created (assignment_id, created_at),
    KEY idx_blueprint_application_logs_client_created (client_id, created_at),
    CONSTRAINT fk_blueprint_application_logs_assignment FOREIGN KEY (assignment_id) REFERENCES client_blueprint_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_blueprint_application_logs_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_blueprint_application_logs_onboarding FOREIGN KEY (onboarding_id) REFERENCES client_onboardings(id) ON DELETE SET NULL,
    CONSTRAINT fk_blueprint_application_logs_blueprint FOREIGN KEY (blueprint_id) REFERENCES blueprints(id) ON DELETE CASCADE,
    CONSTRAINT fk_blueprint_application_logs_version FOREIGN KEY (blueprint_version_id) REFERENCES blueprint_versions(id) ON DELETE CASCADE
);

INSERT INTO client_onboarding_steps (
    onboarding_id,
    client_id,
    step_key,
    step_name,
    step_type,
    is_required,
    step_status,
    attempt_count,
    last_error,
    notes,
    completed_by,
    completed_at,
    sort_order,
    metadata_json,
    created_at,
    updated_at
)
SELECT
    o.id,
    o.client_id,
    'blueprint_applied',
    'Blueprint Applied',
    'action',
    1,
    'pending',
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    3,
    NULL,
    NOW(),
    NOW()
FROM client_onboardings o
WHERE NOT EXISTS (
    SELECT 1
    FROM client_onboarding_steps s
    WHERE s.onboarding_id = o.id
      AND s.step_key = 'blueprint_applied'
);

UPDATE client_onboarding_steps SET sort_order = 1 WHERE step_key = 'registry_verified';
UPDATE client_onboarding_steps SET sort_order = 2 WHERE step_key = 'subscription_verified';
UPDATE client_onboarding_steps SET sort_order = 3 WHERE step_key = 'blueprint_applied';
UPDATE client_onboarding_steps SET sort_order = 4 WHERE step_key = 'initial_admin_created';
UPDATE client_onboarding_steps SET sort_order = 5 WHERE step_key = 'minimum_setup_confirmed';
UPDATE client_onboarding_steps SET sort_order = 6 WHERE step_key = 'readiness_review';
UPDATE client_onboarding_steps SET sort_order = 7 WHERE step_key = 'client_activated';
