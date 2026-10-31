-- Notes privées sur les points : écrites par les superusers (et admins), lues par leur auteur et les admins.
-- Une note par personne et par point. Idempotent.
CREATE TABLE IF NOT EXISTS location_note (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_id INT NOT NULL,
  user_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_location_user (location_id, user_id),
  KEY ix_location (location_id)
);
