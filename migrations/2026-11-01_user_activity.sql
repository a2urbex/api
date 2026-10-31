-- Activité en ligne : last_active_at existe déjà (posée à l'inscription, désormais mise à jour par l'API).
-- hide_activity : la personne masque « en ligne / vu il y a » (les admins voient toujours). Idempotent.
DROP PROCEDURE IF EXISTS a2_add_column;
DELIMITER //
CREATE PROCEDURE a2_add_column(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def, ', ALGORITHM=INPLACE, LOCK=NONE');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

CALL a2_add_column('user', 'last_active_at', 'DATETIME NULL');
CALL a2_add_column('user', 'hide_activity', 'TINYINT(1) NOT NULL DEFAULT 0');

DROP PROCEDURE IF EXISTS a2_add_column;
