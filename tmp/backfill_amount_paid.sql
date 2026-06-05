\echo 'Backfill amount_paid - pagadas'
UPDATE public.invoices i
SET amount_paid = COALESCE(i.total_amount, 0)
WHERE (i.paid_status IS TRUE OR lower(coalesce(i.status, '')) = 'paid')
  AND COALESCE(i.amount_paid, 0) < COALESCE(i.total_amount, 0) - 0.005;

\echo 'Backfill desde sales'
UPDATE public.invoices i
SET amount_paid = LEAST(COALESCE(s.amount_paid, 0), COALESCE(i.total_amount, 0))
FROM public.sales s
WHERE s.invoice_id = i.id
  AND COALESCE(s.amount_paid, 0) > 0
  AND COALESCE(i.amount_paid, 0) < COALESCE(s.amount_paid, 0) - 0.005;

\echo 'Backfill FACCAB rebuild'
WITH rebuilt AS (
  SELECT i.id, (substring(i.notes FROM '"key":\s*"([^"]+)"')) AS fac_key
  FROM public.invoices i
  WHERE i.notes LIKE 'Legacy FACCAB rebuild ·%'
    AND substring(i.notes FROM '"key":\s*"([^"]+)"') IS NOT NULL
),
faccab_cob AS (
  SELECT b.id AS invoice_id,
    LEAST(
      COALESCE(NULLIF(regexp_replace(btrim(f.impcob1::text), ',', '.', 'g'), '')::numeric, 0)
      + COALESCE(NULLIF(regexp_replace(btrim(f.impcob2::text), ',', '.', 'g'), '')::numeric, 0),
      (SELECT COALESCE(total_amount, 0) FROM public.invoices WHERE id = b.id)
    ) AS cobrado
  FROM rebuilt b
  JOIN legacy.faccab f ON (
    COALESCE(NULLIF(btrim(f.serfac::text), ''), 'A') = split_part(b.fac_key, '|', 1)
    AND btrim(f.ejefac::text) = split_part(b.fac_key, '|', 2)
    AND btrim(f.numfac::text) = split_part(b.fac_key, '|', 3)
  )
)
UPDATE public.invoices i SET amount_paid = fc.cobrado
FROM faccab_cob fc
WHERE i.id = fc.invoice_id
  AND fc.cobrado > COALESCE(i.amount_paid, 0) + 0.005;

\echo 'Natalia F2025-03424'
SELECT number, total_amount, amount_paid, total_amount - amount_paid AS pendiente
FROM public.invoices
WHERE number = 'F2025-03424';
