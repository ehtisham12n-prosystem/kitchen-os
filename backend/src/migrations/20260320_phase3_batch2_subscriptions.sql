ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS plan_status ENUM('draft', 'active', 'retired') NOT NULL DEFAULT 'draft' AFTER description,
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) NOT NULL DEFAULT 'PKR' AFTER is_active,
    ADD COLUMN IF NOT EXISTS trial_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER currency_code,
    ADD COLUMN IF NOT EXISTS default_trial_days INT NOT NULL DEFAULT 0 AFTER trial_enabled;

UPDATE subscription_plans
SET
    plan_status = CASE
        WHEN is_active = 1 THEN 'active'
        ELSE 'draft'
    END
WHERE plan_status IS NULL OR plan_status = '';

CREATE TABLE IF NOT EXISTS client_subscriptions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(20) NOT NULL,
    plan_id INT NOT NULL,
    plan_code_snapshot VARCHAR(50) NOT NULL,
    plan_name_snapshot VARCHAR(150) NOT NULL,
    plan_description_snapshot TEXT NULL,
    currency_code_snapshot VARCHAR(10) NULL,
    billing_cycle ENUM('monthly', 'annual') NOT NULL DEFAULT 'monthly',
    subscription_status ENUM('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled') NOT NULL DEFAULT 'pending',
    is_trial TINYINT(1) NOT NULL DEFAULT 0,
    trial_start_at DATETIME NULL,
    trial_end_at DATETIME NULL,
    effective_start_at DATETIME NULL,
    effective_end_at DATETIME NULL,
    activated_at DATETIME NULL,
    expired_at DATETIME NULL,
    suspended_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    price_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
    assignment_reason VARCHAR(255) NULL,
    assignment_notes TEXT NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_client_subscriptions_client (client_id),
    KEY idx_client_subscriptions_plan (plan_id),
    KEY idx_client_subscriptions_status (subscription_status),
    CONSTRAINT fk_client_subscriptions_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_client_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE IF NOT EXISTS client_subscription_history (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(20) NOT NULL,
    subscription_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    from_status ENUM('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled') NULL,
    to_status ENUM('pending', 'trial', 'active', 'expired', 'suspended', 'cancelled') NULL,
    from_plan_id INT NULL,
    to_plan_id INT NULL,
    from_plan_name VARCHAR(150) NULL,
    to_plan_name VARCHAR(150) NULL,
    billing_cycle ENUM('monthly', 'annual') NULL,
    price_snapshot DECIMAL(10, 2) NULL,
    reason VARCHAR(255) NULL,
    notes TEXT NULL,
    changed_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_client_subscription_history_client (client_id),
    KEY idx_client_subscription_history_subscription (subscription_id),
    CONSTRAINT fk_client_subscription_history_client FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_client_subscription_history_subscription FOREIGN KEY (subscription_id) REFERENCES client_subscriptions(id)
);
