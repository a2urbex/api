-- location_status / location_note créées avec la collation par défaut de la base (utf8mb4_bin en prod) :
-- comparer ps.status et l.status (utf8mb4_unicode_ci) échoue (« Illegal mix of collations »).
-- On les aligne sur la table location. Idempotent : relancer ne change rien.
ALTER TABLE location_status CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE location_note CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
