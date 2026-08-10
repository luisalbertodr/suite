-- Deuda v4: SECURITY DEFINER para poder leer legacy.clientes (authenticated no tiene USAGE).
-- Si el cliente tiene legacy_codcli, Style (clientes.deuda) manda: nunca sumar facturas LEG/FAC
-- huérfanas cuando la lectura Style falla o es 0.

CREATE OR REPLACE FUNCTION public.customer_pending_invoice_debt(
  p_company_id uuid,
  p_customer_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, legacy
AS $$
  WITH cust AS (
    SELECT
      c.id,
      NULLIF(btrim(c.legacy_codcli::text), '') AS legacy_codcli
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.company_id = p_company_id
  ),
  style_deuda AS (
    SELECT COALESCE(
      (
        SELECT COALESCE(
          NULLIF(regexp_replace(btrim(lc.deuda::text), ',', '.', 'g'), '')::numeric,
          0
        )
        FROM legacy.clientes lc
        CROSS JOIN cust
        WHERE cust.legacy_codcli IS NOT NULL
          AND btrim(lc.codcli::text) IN (
            cust.legacy_codcli,
            ltrim(cust.legacy_codcli, '0'),
            lpad(ltrim(cust.legacy_codcli, '0'), 6, '0')
          )
        LIMIT 1
      ),
      0::numeric
    ) AS deuda
  ),
  inv AS (
    SELECT
      i.id,
      i.total_amount,
      i.amount_paid,
      i.paid_status,
      i.status,
      i.notes,
      i.issue_date,
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
      END AS sc_numfac,
      CASE
        WHEN i.notes LIKE 'Legacy FACCAB rebuild%'
          OR i.notes LIKE 'Factura legacy sin cita%'
          OR i.notes LIKE 'Factura legacy automática%'
          OR i.number LIKE 'LEG-%'
        THEN true
        ELSE false
      END AS is_legacy_import
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.customer_id = p_customer_id
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada', 'paid')
      AND coalesce(i.total_amount, 0) > 0
      AND NOT (
        (
          i.notes LIKE 'Factura legacy automática%'
          OR i.notes LIKE 'Factura legacy sin cita%'
        )
        AND EXISTS (
          SELECT 1
          FROM public.invoices i2
          WHERE i2.customer_id = i.customer_id
            AND i2.company_id = i.company_id
            AND i2.issue_date = i.issue_date
            AND i2.notes LIKE 'Legacy FACCAB rebuild%'
        )
      )
      AND NOT (
        i.notes LIKE 'Factura legacy sin cita · key %'
        AND EXISTS (
          SELECT 1
          FROM public.invoices i2
          WHERE i2.customer_id = i.customer_id
            AND i2.company_id = i.company_id
            AND i2.notes LIKE 'Legacy FACCAB rebuild%'
            AND (
              substring(i2.notes FROM '"key":\s*"([^"]+)"')
              = (
                  'A|'
                  || to_char(i.issue_date, 'YYYY')
                  || '|'
                  || trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 3))
                )
              OR i2.number = (
                  'LEG-A-'
                  || to_char(i.issue_date, 'YYYY')
                  || '-'
                  || trim(split_part(replace(i.notes, 'Factura legacy sin cita · key ', ''), '|', 3))
                )
            )
        )
      )
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
  ),
  pending AS (
    SELECT
      inv.is_legacy_import,
      GREATEST(
        COALESCE(inv.total_amount, 0)
        - GREATEST(
            lc.cobrado_legacy,
            COALESCE(inv.amount_paid, 0),
            CASE WHEN inv.paid_status IS TRUE THEN COALESCE(inv.total_amount, 0) ELSE 0 END
          ),
        0
      ) AS pendiente
    FROM inv
    JOIN legacy_cob lc ON lc.id = inv.id
  ),
  suite_native AS (
    SELECT COALESCE(ROUND(SUM(pendiente)::numeric, 2), 0) AS debt
    FROM pending
    WHERE pendiente > 0.005
      AND NOT is_legacy_import
  ),
  invoice_legacy AS (
    SELECT COALESCE(ROUND(SUM(pendiente)::numeric, 2), 0) AS debt
    FROM pending
    WHERE pendiente > 0.005
      AND is_legacy_import
  )
  SELECT COALESCE(
    ROUND(
      (
        COALESCE((SELECT debt FROM suite_native), 0)
        + CASE
            -- Cliente con código Style: saldo histórico = legacy.clientes.deuda (0 si no hay fila)
            WHEN (SELECT legacy_codcli FROM cust) IS NOT NULL
            THEN GREATEST(COALESCE((SELECT deuda FROM style_deuda), 0), 0)
            ELSE COALESCE((SELECT debt FROM invoice_legacy), 0)
          END
      )::numeric,
      2
    ),
    0
  );
$$;

COMMENT ON FUNCTION public.customer_pending_invoice_debt(uuid, uuid) IS
  'Deuda pendiente: facturas Suite nativas + legacy.clientes.deuda (SECURITY DEFINER).';

GRANT EXECUTE ON FUNCTION public.customer_pending_invoice_debt(uuid, uuid) TO authenticated, service_role;
