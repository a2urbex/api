-- Statuts personnels (Valid / Invalid / note / Danger) des non-admins : visibles par l'auteur, ses amis et les admins.
-- Le statut global (colonnes de location) reste celui posé par les admins. Une ligne par personne et par point. Idempotent.
CREATE TABLE IF NOT EXISTS location_status (
  location_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('valid','invalid') NOT NULL,
  rating VARCHAR(32) NULL,
  invalid_reason VARCHAR(32) NULL,
  danger TINYINT(1) NOT NULL DEFAULT 0,
  visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (location_id, user_id),
  KEY ix_user (user_id)
);
