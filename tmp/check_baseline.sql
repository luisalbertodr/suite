SELECT tabla, enabled, dbf_baseline_seeded, last_id, last_ok_at, last_error
FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla IN ('faccab', 'ciecab', 'albcab')
ORDER BY tabla;

SELECT tabla, count(*) FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla IN ('faccab', 'ciecab')
GROUP BY tabla;
