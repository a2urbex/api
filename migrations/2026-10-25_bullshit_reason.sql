-- Motif d'invalidité « bullshit » (le point est masqué aussitôt). Idempotent : MODIFY réécrit la même définition.
-- 'walled' reste accepté pour les anciens statuts.
ALTER TABLE location MODIFY invalid_reason ENUM('walled','no_access','demolished','guarded','reused','not_found','bullshit') NULL;
ALTER TABLE location_visit MODIFY invalid_reason ENUM('walled','no_access','demolished','guarded','reused','not_found','bullshit') NULL;
