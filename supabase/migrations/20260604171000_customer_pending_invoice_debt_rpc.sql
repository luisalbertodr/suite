-- Deuda pendiente por cliente (total - cobrado legacy), sin depender de amount_paid en UI.
CREATE OR REPLACE FUNCTION public.customer_pending_invoice_debt(
  p_company_id uuid,
  p_customer_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, legacy
AS $$
  WITH inv AS (
    SELECT
      i.id,
      i.total_amount,
      i.paid_status,
      i.status,
      i.notes,
      (substring(i.notes FROM '"key":\s*"([^"]+)"')) AS fac_key_json,
      CASE
        WHEN i.notes LIKE 'Factura legacy sin cita · key %' THEN
          trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 1))
        ELSE NULL
      END AS sc_codcli,
      CASE
        WHEN i.notes LIKE 'Factura legacy sin cita · key %' THEN
          trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 2))
        ELSE NULL
      END AS sc_fecfac,
      CASE
        WHEN i.notes LIKE 'Factura legacy sin cita · key %' THEN
          trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 3))
        ELSE NULL
      END AS sc_numfac
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.customer_id = p_customer_id
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada', 'paid')
  ),
  legacy_cob AS (
    SELECT
      inv.id,
      LEAST(
        COALESCE(
          (
            SELECT
              COALESCE(NULLIF(regexp_replace(btrim(f.impcob1::text), ',', '.', 'g'), '')::numeric, 0)
              + COALESCE(NULLIF(regexp_replace(btrim(f.impcob2::text), ',', '.', 'g'), '')::numeric, 0)
            FROM legacy.faccab f
            WHERE inv.fac_key_json IS NOT NULL
              AND COALESCE(NULLIF(btrim(f.serfac::text), ''), 'A') = split_part(inv.fac_key_json, '|', 1)
              AND btrim(f.ejefac::text) = split_part(inv.fac_key_json, '|', 2)
              AND btrim(f.numfac::text) = split_part(inv.fac_key_json, '|', 3)
            LIMIT 1
          ),
          (
            SELECT
              COALESCE(NULLIF(regexp_replace(btrim(f.impcob1::text), ',', '.', 'g'), '')::numeric, 0)
              + COALESCE(NULLIF(regexp_replace(btrim(f.impcob2::text), ',', '.', 'g'), '')::numeric, 0)
            FROM legacy.faccab f
            WHERE inv.sc_codcli IS NOT NULL
              AND btrim(f.codcli::text) IN (
                inv.sc_codcli,
                ltrim(inv.sc_codcli, '0'),
                lpad(ltrim(inv.sc_codcli, '0'), 6, '0')
              )
              AND f.fecfac::text LIKE inv.sc_fecfac || '%'
              AND btrim(f.numfac::text) = inv.sc_numfac
              AND COALESCE(NULLIF(btrim(f.serfac::text), ''), 'A') IN ('', 'A')
            LIMIT 1
          ),
          0
        ),
        COALESCE(inv.total_amount, 0)
      ) AS cobrado_legacy
    FROM inv
  )
  SELECT COALESCE(
    ROUND(
      SUM(
        GREATEST(
          COALESCE(inv.total_amount, 0)
          - GREATEST(
              lc.cobrado_legacy,
              CASE WHEN inv.paid_status IS TRUE THEN COALESCE(inv.total_amount, 0) ELSE 0 END
            ),
          0
        )
      )::numeric,
      2
    ),
    0
  )
  FROM inv
  JOIN legacy_cob lc ON lc.id = inv.id;
$$;

COMMENT ON FUNCTION public.customer_pending_invoice_debt(uuid, uuid) IS
  'Suma facturas pendientes: total_amount menos cobrado (amount_paid o impcob legacy).';

GRANT EXECUTE ON FUNCTION public.customer_pending_invoice_debt(uuid, uuid) TO authenticated, service_role;
