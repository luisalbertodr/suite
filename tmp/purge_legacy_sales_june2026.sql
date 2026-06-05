DELETE FROM public.sale_items si
USING public.sales s
WHERE si.sale_id = s.id
  AND s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND s.created_at >= TIMESTAMPTZ '2026-06-01'
  AND s.created_at < TIMESTAMPTZ '2026-07-01'
  AND (s.ticket_number LIKE 'LEG-%' OR COALESCE(s.notes, '') ILIKE '%legacy%');

DELETE FROM public.sales s
WHERE s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND s.created_at >= TIMESTAMPTZ '2026-06-01'
  AND s.created_at < TIMESTAMPTZ '2026-07-01'
  AND (s.ticket_number LIKE 'LEG-%' OR COALESCE(s.notes, '') ILIKE '%legacy%');
