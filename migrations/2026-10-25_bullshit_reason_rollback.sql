-- Annule 2026-10-25_bullshit_reason.sql : les « bullshit » redeviennent « not_found » (les points restent masqués).
UPDATE location SET invalid_reason = 'not_found' WHERE invalid_reason = 'bullshit';
UPDATE location_visit SET invalid_reason = 'not_found' WHERE invalid_reason = 'bullshit';
ALTER TABLE location MODIFY invalid_reason ENUM('walled','no_access','demolished','guarded','reused','not_found') NULL;
ALTER TABLE location_visit MODIFY invalid_reason ENUM('walled','no_access','demolished','guarded','reused','not_found') NULL;
