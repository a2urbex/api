-- Rollback of 2026-10-22_new_features.sql. Idempotent.
-- WARNING: drops field-mode history, exploration sessions, push subscriptions and preferences.
DROP PROCEDURE IF EXISTS a2_drop_column;
DROP PROCEDURE IF EXISTS a2_drop_index;
DELIMITER //
CREATE PROCEDURE a2_drop_column(IN tbl VARCHAR(64), IN col VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` DROP COLUMN `', col, '`');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
CREATE PROCEDURE a2_drop_index(IN tbl VARCHAR(64), IN idx VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` DROP INDEX `', idx, '`, ALGORITHM=INPLACE, LOCK=NONE');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

CALL a2_drop_index('location', 'ix_location_date_add');
CALL a2_drop_index('location', 'ix_location_lat_lon');
CALL a2_drop_index('location', 'ix_location_status');

DROP TABLE IF EXISTS user_notification_pref;
DROP TABLE IF EXISTS notification_channel;
DROP TABLE IF EXISTS push_subscription;
DROP TABLE IF EXISTS exploration_session;
DROP TABLE IF EXISTS location_visit;

CALL a2_drop_column('favorite', 'status');
CALL a2_drop_column('user', 'default_country');
CALL a2_drop_column('location', 'visited_at');
CALL a2_drop_column('location', 'danger');
CALL a2_drop_column('location', 'invalid_reason');
CALL a2_drop_column('location', 'rating');
CALL a2_drop_column('location', 'status');

DROP PROCEDURE IF EXISTS a2_drop_column;
DROP PROCEDURE IF EXISTS a2_drop_index;
