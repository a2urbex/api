-- a2urbex new features. Idempotent: safe to re-run.
DROP PROCEDURE IF EXISTS a2_add_column;
DROP PROCEDURE IF EXISTS a2_add_index;
DELIMITER //
CREATE PROCEDURE a2_add_column(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def, ', ALGORITHM=INPLACE, LOCK=NONE');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
CREATE PROCEDURE a2_add_index(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, '), ALGORITHM=INPLACE, LOCK=NONE');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

-- Phase 1: field status on points + visit log
CALL a2_add_column('location', 'status', "ENUM('unvisited','valid','invalid') NOT NULL DEFAULT 'unvisited'");
CALL a2_add_column('location', 'rating', "ENUM('amazing','nice','meh','empty') NULL");
CALL a2_add_column('location', 'invalid_reason', "ENUM('walled','no_access','demolished','guarded','reused','not_found') NULL");
CALL a2_add_column('location', 'danger', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL a2_add_column('location', 'visited_at', 'DATETIME NULL');
CALL a2_add_index('location', 'ix_location_status', '`status`');

CREATE TABLE IF NOT EXISTS location_visit (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('valid','invalid') NOT NULL,
  rating ENUM('amazing','nice','meh','empty') NULL,
  invalid_reason ENUM('walled','no_access','demolished','guarded','reused','not_found') NULL,
  danger TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_visit_location (location_id, created_at),
  KEY ix_visit_user (user_id, created_at)
);

-- Phase 3: default country (NULL = Auto). Roles stay JSON text in user.roles; 'demo' needs no schema change.
CALL a2_add_column('user', 'default_country', 'CHAR(2) NULL');

-- Phase 4: list exploration status + exploration sessions
CALL a2_add_column('favorite', 'status', "ENUM('upcoming','in_progress','finished') NOT NULL DEFAULT 'upcoming'");

CREATE TABLE IF NOT EXISTS exploration_session (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  favorite_id INT NOT NULL,
  started_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  KEY ix_exploration_user (user_id, ended_at, expires_at)
);

-- Phase 6: push notifications
CREATE TABLE IF NOT EXISTS push_subscription (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_push_endpoint (endpoint(191)),
  KEY ix_push_user (user_id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_channel (
  channel VARCHAR(32) PRIMARY KEY,
  label VARCHAR(64) NOT NULL,
  critical TINYINT(1) NOT NULL DEFAULT 0,
  admin_only TINYINT(1) NOT NULL DEFAULT 0
) DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO notification_channel (channel, label, critical, admin_only) VALUES
  ('admin_system', 'System reports', 1, 1),
  ('users_news', 'New spots', 0, 0),
  ('outings', 'Outings', 0, 0);
-- "New spots" is admin-only (re-run safe)
UPDATE notification_channel SET admin_only = 1 WHERE channel = 'users_news';

CREATE TABLE IF NOT EXISTS user_notification_pref (
  user_id INT NOT NULL,
  channel VARCHAR(32) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, channel)
) DEFAULT CHARSET=utf8mb4;

-- Importers (Wikimedia Commons, Wikidata, Flickr): original image, credit and licence; idempotency key (source, pid)
CALL a2_add_column('location', 'image_url', 'VARCHAR(512) NULL');
CALL a2_add_column('location', 'image_credit', 'VARCHAR(255) NULL');
CALL a2_add_column('location', 'image_license', 'VARCHAR(64) NULL');
CALL a2_add_index('location', 'ix_location_source_pid', '`source`(100), `pid`');

-- Phase 2: zone drawing (bbox prefilter) + import date slider
CALL a2_add_index('location', 'ix_location_lat_lon', '`lat`, `lon`');
CALL a2_add_index('location', 'ix_location_date_add', '`date_add`, `lat`, `lon`');

DROP PROCEDURE IF EXISTS a2_add_column;
DROP PROCEDURE IF EXISTS a2_add_index;
