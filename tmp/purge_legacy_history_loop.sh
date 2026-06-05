#!/bin/bash
# Purga facturas legacy duplicadas por rango de fechas (lotes de 150).
# Uso: bash purge_legacy_history_loop.sh 2010-01-01 2026-01-01
set -euo pipefail

FROM_DATE="${1:?from-date}"
TO_DATE="${2:?to-date}"
LABEL="${FROM_DATE}..${TO_DATE}"

run_batch() {
  docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -tA <<SQL
WITH targets AS (
  SELECT i.id
  FROM public.invoices i
  WHERE i.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
    AND i.issue_date >= DATE '${FROM_DATE}'
    AND i.issue_date < DATE '${TO_DATE}'
    AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
    AND (
      i.number LIKE 'LEG-%'
      OR COALESCE(i.notes, '') ILIKE '%legacy%'
      OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
      OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
      OR i.number ~ '^FAC-[0-9]'
    )
  LIMIT 150
),
_ AS (
  UPDATE public.invoices SET original_invoice_id = NULL
  WHERE original_invoice_id IN (SELECT id FROM targets)
),
__ AS (
  UPDATE public.invoices SET original_invoice_id = NULL
  WHERE id IN (SELECT id FROM targets)
),
___ AS (
  DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM targets)
),
____ AS (
  UPDATE public.sales SET invoice_id = NULL WHERE invoice_id IN (SELECT id FROM targets)
),
deleted AS (
  DELETE FROM public.invoices WHERE id IN (SELECT id FROM targets) RETURNING id
)
SELECT COUNT(*)::int FROM deleted;
SQL
}

echo "=== Purga legacy ${LABEL} ==="
total=0
for round in $(seq 1 5000); do
  n=$(run_batch | tail -1 | tr -d ' ')
  if [ -z "$n" ] || [ "$n" = "0" ]; then
    echo "Fin ${LABEL} ronda $round (total $total)"
    break
  fi
  total=$((total + n))
  if [ $((round % 20)) -eq 0 ]; then
    echo "  ${LABEL} ronda $round: acum $total"
  fi
done
