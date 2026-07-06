-- Exclusiones de facturación Style (facturas erróneas / no sincronizables).
-- Dashboard hub: solo facturas con mapeo Style activo, excluyendo canceladas y esta lista.

CREATE TABLE IF NOT EXISTS dunasoft.style_sync_billing_exclusions (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  style_key  text NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, style_key)
);

COMMENT ON TABLE dunasoft.style_sync_billing_exclusions IS
  'Facturas Style excluidas de sync y de totales de facturación (datos erróneos en VFP).';

GRANT SELECT, INSERT, UPDATE, DELETE ON dunasoft.style_sync_billing_exclusions TO service_role;

-- A/950: fallo RPC persistente — cancelar, quitar mapeo, no reintentar.
INSERT INTO dunasoft.style_sync_billing_exclusions (company_id, style_key, reason)
SELECT dunasoft.style_sync_hub_company_id(), m.style_key,
       'Factura errónea A/950 — excluida de sync y dashboard'
FROM dunasoft.style_sync_entity_map m
WHERE m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.entity_type = 'invoice'
  AND (m.style_key LIKE 'A/950/%' OR m.style_key LIKE '%/950/%')
ON CONFLICT (company_id, style_key) DO NOTHING;

UPDATE public.invoices i
SET status = 'cancelled',
    notes = coalesce(notes, '') || E'\nStyle sync errónea — excluida',
    updated_at = now()
FROM dunasoft.style_sync_entity_map m
WHERE m.suite_id = i.id
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.entity_type = 'invoice'
  AND (m.style_key LIKE 'A/950/%' OR i.number = 'A-950')
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada');

DELETE FROM dunasoft.style_sync_entity_map m
WHERE m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.entity_type = 'invoice'
  AND m.style_key LIKE 'A/950/%';

-- Serie mensual de facturación para dashboard.
-- Hub Style: facturas enlazadas en style_sync_entity_map (pueden estar en empresa emisora distinta).
CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly(
  p_company_id uuid,
  p_year       int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  month_key text,
  total     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  SELECT
    extract(month FROM i.issue_date)::int AS month_num,
    to_char(i.issue_date, 'YYYY-MM') AS month_key,
    round(sum(coalesce(i.total_amount, 0))::numeric, 2) AS total
  FROM public.invoices i
  LEFT JOIN dunasoft.style_sync_entity_map m
    ON m.suite_id = i.id
   AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e
    ON e.company_id = coalesce(m.company_id, i.company_id)
   AND e.style_key = m.style_key
  WHERE extract(year FROM i.issue_date) = coalesce(p_year, extract(year FROM current_date)::int)
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND (
      CASE
        WHEN p_company_id = dunasoft.style_sync_hub_company_id() THEN
          m.company_id = p_company_id
        ELSE
          i.company_id = p_company_id
      END
    )
  GROUP BY 1, 2
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly(uuid, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_monthly IS
  'Facturación mensual IVA incl. Hub Style: facturas con mapeo sync. Otras empresas: facturas propias.';

-- Saltar facturas excluidas en apply (parche mínimo al inicio del cuerpo existente).
CREATE OR REPLACE FUNCTION dunasoft.style_invoice_sync_excluded(
  p_company_id uuid,
  p_serie text,
  p_numfac text,
  p_codcli text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM dunasoft.style_sync_billing_exclusions e
    WHERE e.company_id = p_company_id
      AND (
        e.style_key LIKE coalesce(nullif(btrim(p_serie), ''), 'A') || '/' || btrim(p_numfac) || '/%'
        OR e.style_key = coalesce(nullif(btrim(p_serie), ''), 'A') || '/' || btrim(p_numfac) || '/' || btrim(p_codcli)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_invoice_sync_excluded(uuid, text, text, text) TO service_role;
