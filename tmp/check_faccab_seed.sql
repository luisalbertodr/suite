SELECT count(*) AS faccab_fps FROM dunasoft.style_sync_dbf_fingerprint WHERE tabla = 'faccab';
SELECT dbf_baseline_seeded, count(*) FROM dunasoft.style_sync_cursor WHERE tabla IN ('faccab','ciecab') GROUP BY 1;
SELECT checkpoint_key FROM dunasoft.style_sync_billing_checkpoints WHERE checkpoint_key = 'resync_faccab_2026';
