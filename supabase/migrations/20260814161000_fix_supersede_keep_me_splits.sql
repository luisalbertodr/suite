-- No anular splits M/E legítimos: solo supersede duplicados de la MISMA empresa emisora.
CREATE OR REPLACE FUNCTION dunasoft.style_billing_supersede_legacy_short_number(
  p_company_id   uuid,
  p_fiscal_year  int,
  p_serie        text,
  p_numfac       text,
  p_codcli       text,
  p_canonical_key text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_legacy_id uuid;
  v_legacy_key text;
  v_count int := 0;
  v_short_number text := coalesce(nullif(btrim(p_serie), ''), 'A') || '-' || btrim(p_numfac);
  v_canon_billing text := split_part(p_canonical_key, '/', 5);
BEGIN
  FOR v_legacy_id, v_legacy_key IN
    SELECT i.id, m.style_key
    FROM public.invoices i
    INNER JOIN dunasoft.style_sync_entity_map m
      ON m.suite_id = i.id AND m.entity_type = 'invoice'
    WHERE m.company_id = p_company_id
      AND m.style_key LIKE p_fiscal_year::text || '/' || coalesce(nullif(btrim(p_serie), ''), 'A') || '/'
        || btrim(p_numfac) || '/' || btrim(p_codcli) || '/%'
      AND i.number = v_short_number
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      AND m.style_key IS DISTINCT FROM p_canonical_key
      -- Misma empresa fiscal en la clave: evita matar el tramo Estética/Medicina hermano
      AND split_part(m.style_key, '/', 5) = v_canon_billing
  LOOP
    UPDATE public.invoices i
    SET status = 'cancelled',
        notes = coalesce(i.notes, '') || E'\nSuperseded by ' || p_canonical_key,
        updated_at = now()
    WHERE i.id = v_legacy_id;

    INSERT INTO dunasoft.style_sync_billing_exclusions (company_id, style_key, reason)
    VALUES (
      p_company_id,
      v_legacy_key,
      'Superseded by canonical ' || p_canonical_key
    )
    ON CONFLICT (company_id, style_key) DO UPDATE
    SET reason = EXCLUDED.reason;

    DELETE FROM dunasoft.style_sync_billing_fiscal
    WHERE company_id = p_company_id AND style_key = v_legacy_key;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION dunasoft.style_billing_supersede_legacy_short_number(uuid, int, text, text, text, text) IS
  'Anula duplicados de la misma empresa emisora; no toca splits M/E con distinto billing en style_key.';

-- Quitar exclusiones erróneas de splits (Superseded entre empresas distintas)
DELETE FROM dunasoft.style_sync_billing_exclusions e
WHERE e.reason LIKE 'Superseded by canonical %'
  AND split_part(e.style_key, '/', 5) IS DISTINCT FROM split_part(substring(e.reason from 'canonical (.*)$'), '/', 5);

-- Rehabilitar facturas canceladas por ese supersede cruzado (jun/jul 2026)
UPDATE public.invoices i
SET status = 'paid',
    updated_at = now(),
    notes = regexp_replace(coalesce(i.notes, ''), E'\\nSuperseded by [^\\n]*', '', 'g')
FROM dunasoft.style_sync_entity_map m
WHERE m.suite_id = i.id
  AND m.entity_type = 'invoice'
  AND m.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND m.style_key LIKE '2026/%'
  AND i.status = 'cancelled'
  AND i.notes ILIKE '%Superseded by%'
  AND i.issue_date >= '2026-06-01' AND i.issue_date < '2026-08-01';

SELECT public.dashboard_billing_invalidate('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '2026-06-01'::date);
SELECT public.dashboard_billing_invalidate('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '2026-07-01'::date);
