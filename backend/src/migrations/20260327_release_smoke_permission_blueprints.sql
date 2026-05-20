CREATE TABLE IF NOT EXISTS `permission_blueprints` (
  `id` char(36) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text NULL,
  `icon` varchar(50) NULL,
  `config_json` text NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_permission_blueprints_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
