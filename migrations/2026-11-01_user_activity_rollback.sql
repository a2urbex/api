-- Annule 2026-11-01_user_activity.sql (last_active_at est conservée : elle existait avant)
ALTER TABLE user DROP COLUMN hide_activity;
