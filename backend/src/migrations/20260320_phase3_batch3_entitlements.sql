CREATE TABLE IF NOT EXISTS platform_features (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    feature_key VARCHAR(50) NOT NULL,
    feature_name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_platform_features_key (feature_key)
);

CREATE TABLE IF NOT EXISTS subscription_plan_features (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    feature_id INT NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_subscription_plan_features_plan_feature (plan_id, feature_id),
    KEY idx_subscription_plan_features_plan (plan_id),
    KEY idx_subscription_plan_features_feature (feature_id),
    CONSTRAINT fk_subscription_plan_features_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    CONSTRAINT fk_subscription_plan_features_feature FOREIGN KEY (feature_id) REFERENCES platform_features(id)
);

CREATE TABLE IF NOT EXISTS client_feature_overrides (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(20) NOT NULL,
    feature_id INT NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    reason VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_client_feature_overrides_client_feature (client_id, feature_id),
    KEY idx_client_feature_overrides_client (client_id),
    KEY idx_client_feature_overrides_feature (feature_id),
    CONSTRAINT fk_client_feature_overrides_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_client_feature_overrides_feature FOREIGN KEY (feature_id) REFERENCES platform_features(id)
);

CREATE TABLE IF NOT EXISTS client_limit_overrides (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(20) NOT NULL,
    limit_key ENUM('max_branches', 'max_active_users', 'max_pos_devices') NOT NULL,
    limit_value INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_client_limit_overrides_client_limit (client_id, limit_key),
    KEY idx_client_limit_overrides_client (client_id),
    CONSTRAINT fk_client_limit_overrides_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS plan_max_pos_devices INT NOT NULL DEFAULT 1 AFTER plan_max_users;
