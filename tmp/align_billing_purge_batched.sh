#!/bin/bash
set -euo pipefail

run_sql() {
  docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

purge_range() {
  local start="$1"
  local end="$2"
  echo "=== Purga $start .. $end ==="
  run_sql <<SQL
BEGIN;
UPDATE public.invoices SET original_invoice_id = NULL
WHERE original_invoice_id IN (
  SELECT i.id FROM public.invoices i
  WHERE i.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
    AND i.issue_date >= DATE '$start' AND i.issue_date < DATE '$end'
    AND i.issue_date < DATE '2026-06-04'
    AND (
      i.number LIKE 'LEG-%'
      OR COALESCE(i.notes, '') ILIKE '%legacy%'
      OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
      OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
      OR i.number ~ '^FAC-[0-9]'
    )
);
UPDATE public.invoices SET original_invoice_id = NULL
WHERE company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND issue_date >= DATE '$start' AND issue_date < DATE '$end'
  AND issue_date < DATE '2026-06-04'
  AND (
    number LIKE 'LEG-%'
    OR COALESCE(notes, '') ILIKE '%legacy%'
    OR COALESCE(notes, '') ILIKE '%Legacy FACCAB%'
    OR COALESCE(notes, '') ILIKE '%Factura legacy%'
    OR number ~ '^FAC-[0-9]'
  );
DELETE FROM public.invoice_items ii
USING public.invoices i
WHERE ii.invoice_id = i.id
  AND i.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND i.issue_date >= DATE '$start' AND i.issue_date < DATE '$end'
  AND i.issue_date < DATE '2026-06-04'
  AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
  AND (
    i.number LIKE 'LEG-%'
    OR COALESCE(i.notes, '') ILIKE '%legacy%'
    OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
    OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
    OR i.number ~ '^FAC-[0-9]'
  );
DELETE FROM public.invoices i
WHERE i.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND i.issue_date >= DATE '$start' AND i.issue_date < DATE '$end'
  AND i.issue_date < DATE '2026-06-04'
  AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
  AND (
    i.number LIKE 'LEG-%'
    OR COALESCE(i.notes, '') ILIKE '%legacy%'
    OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
    OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
    OR i.number ~ '^FAC-[0-9]'
  );
COMMIT;
SQL
}

y=2010
while [ "$y" -le 2026 ]; do
  m=1
  while [ "$m" -le 12 ]; do
    start=$(printf '%04d-%02d-01' "$y" "$m")
    if [ "$m" -eq 12 ]; then
      end=$(printf '%04d-01-01' $((y + 1)))
    else
      end=$(printf '%04d-%02d-01' "$y" $((m + 1)))
    fi
    if [[ "$start" > "2026-05-31" ]]; then
      break 2
    fi
    purge_range "$start" "$end" || echo "WARN fallo $start"
    m=$((m + 1))
  done
  y=$((y + 1))
done

echo "=== Ventas legacy ==="
run_sql <<'SQL'
DELETE FROM public.sale_items si
USING public.sales s
WHERE si.sale_id = s.id
  AND s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND (s.ticket_number LIKE 'LEG-%' OR COALESCE(s.notes, '') ILIKE '%legacy%');
DELETE FROM public.sales s
WHERE s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND (s.ticket_number LIKE 'LEG-%' OR COALESCE(s.notes, '') ILIKE '%legacy%');
SQL

run_sql -tAc "SELECT COUNT(*) AS invoices FROM public.invoices"
run_sql -tAc "SELECT COUNT(*) AS legacy_left FROM public.invoices WHERE notes ILIKE '%legacy%' OR number LIKE 'LEG-%'"
echo DONE
