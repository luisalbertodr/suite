UPDATE dunasoft.style_sync_cursor
SET dbf_baseline_seeded = false, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND tabla = 'clientes';

DELETE FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND tabla = 'clientes';

-- Forzar re-sync de Luis Alberto (codcli 553) en el próximo tick con huella distinta
DELETE FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla = 'clientes'
  AND style_key IN ('553', '000553');

SELECT tabla, dbf_baseline_seeded FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND tabla = 'clientes';
