CREATE TABLE IF NOT EXISTS import_job (
  id CHAR(36) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  size INT UNSIGNED NOT NULL DEFAULT 0,
  state ENUM('running','finished','error') NOT NULL DEFAULT 'running',
  category_id INT NULL,
  assignee_id INT NULL,
  uploader_id INT NULL,
  favorite_id INT NULL,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  inserted INT UNSIGNED NOT NULL DEFAULT 0,
  skipped INT UNSIGNED NOT NULL DEFAULT 0,
  updated INT UNSIGNED NOT NULL DEFAULT 0,
  options JSON NULL,
  error TEXT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  KEY ix_started_at (started_at)
);
