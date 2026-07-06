#!/bin/bash
CID='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
PSQL="docker exec supabase-db psql -U postgres -d postgres -t -A"

echo "=== entity_map counts ==="
$PSQL -c "
SELECT entity_type, count(*) FROM dunasoft.style_sync_entity_map
WHERE company_id='$CID' GROUP BY entity_type ORDER BY entity_type;
"

echo "=== customers (Luisa 8201) ==="
$PSQL -c "
SELECT legacy_codcli, name, birth_date, phone, email
FROM public.customers
WHERE company_id='$CID' AND public.legacy_codcli_to_bigint(legacy_codcli)=8201;
"

echo "=== sales recent (jul 2026) ==="
$PSQL -c "
SELECT count(*) FROM public.sales
WHERE company_id='$CID' AND sale_date >= '2026-07-01' AND sale_date < '2026-08-01';
"
$PSQL -c "
SELECT legacy_numalb, sale_date, total, legacy_codcli
FROM public.sales WHERE company_id='$CID' AND sale_date='2026-07-02' LIMIT 5;
"

echo "=== invoices recent (jul 2026) ==="
$PSQL -c "
SELECT count(*) FROM public.invoices
WHERE company_id='$CID' AND invoice_date >= '2026-07-01' AND invoice_date < '2026-08-01';
"
$PSQL -c "
SELECT legacy_numfac, invoice_date, total FROM public.invoices
WHERE company_id='$CID' AND invoice_date='2026-07-02' LIMIT 5;
"

echo "=== bonos sample ==="
$PSQL -c "
SELECT count(*) FROM public.bonos WHERE company_id='$CID';
"
$PSQL -c "
SELECT legacy_codboncli, legacy_codcli, purchase_date, expiry_date, sessions_total
FROM public.bonos WHERE company_id='$CID' ORDER BY purchase_date DESC NULLS LAST LIMIT 3;
"

echo "=== cash sessions ==="
$PSQL -c "
SELECT count(*) FROM public.cash_register_sessions WHERE company_id='$CID';
"
$PSQL -c "
SELECT session_date, cash_total, card_total FROM public.cash_register_sessions
WHERE company_id='$CID' ORDER BY session_date DESC LIMIT 3;
"

echo "=== sync cursors ==="
$PSQL -c "
SELECT tabla, enabled, dbf_baseline_seeded FROM dunasoft.style_sync_cursor
WHERE company_id='$CID' ORDER BY tabla;
"
