-- Tables de l'import Pinterest (absentes du dépôt jusqu'ici). Idempotent : sans effet si elles existent déjà.
CREATE TABLE IF NOT EXISTS pinterest_settings (
  id INT PRIMARY KEY,
  cron_enabled TINYINT(1) NOT NULL DEFAULT 1,
  cron_expression VARCHAR(64) NOT NULL DEFAULT '0 3 * * *',
  source_id INT NULL
);

CREATE TABLE IF NOT EXISTS pinterest_job (
  id CHAR(36) PRIMARY KEY,
  state ENUM('running','finished','error','stopped') NOT NULL DEFAULT 'running',
  trigger_type ENUM('manual','cron') NOT NULL DEFAULT 'manual',
  source_id INT NULL,
  user_id INT NULL,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  inserted INT UNSIGNED NOT NULL DEFAULT 0,
  skipped INT UNSIGNED NOT NULL DEFAULT 0,
  failed INT UNSIGNED NOT NULL DEFAULT 0,
  error TEXT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  KEY ix_started_at (started_at)
);
