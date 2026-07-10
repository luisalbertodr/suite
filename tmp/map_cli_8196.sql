INSERT INTO dunasoft.style_sync_entity_map (company_id, entity_type, style_key, suite_id, updated_at)
VALUES
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'customer', '8196', '3649c524-71a3-4095-829c-01f54492185e', now()),
  ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4', 'customer', '008196', '3649c524-71a3-4095-829c-01f54492185e', now())
ON CONFLICT (company_id, entity_type, style_key) DO UPDATE SET suite_id = EXCLUDED.suite_id, updated_at = now();

UPDATE public.invoices SET number = 'A-2025-1512-orphan'
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND number = 'A-1512' AND status = 'cancelled' AND issue_date < '2026-01-01';
