\pset format aligned

\echo '=== DUNASOFT plan2009 Joanella ==='
SELECT p.idplan, p.fecha, p.hora, p.nombre, p.codcli, p.facturado, p.anulado
FROM dunasoft.plan2009 p
WHERE p.nombre ILIKE '%Joanella%' OR p.nombre ILIKE '%Gonzalez%'
ORDER BY p.fecha DESC LIMIT 15;

\echo '=== DUNASOFT by codcli if known ==='
SELECT p.idplan, p.fecha, p.hora, p.nombre, p.codcli, p.facturado
FROM dunasoft.plan2009 p
WHERE p.codcli IN (
  SELECT legacy_codcli FROM customers WHERE id = 'fdefad63-3062-4085-9c15-9effc3e4c3ff'
)
ORDER BY p.fecha DESC LIMIT 10;

\echo '=== CUSTOMER legacy ==='
SELECT id, name, legacy_codcli, phone FROM customers WHERE id = 'fdefad63-3062-4085-9c15-9effc3e4c3ff';

\echo '=== PLANINC recent Joanella ==='
SELECT id, idplan, fecha, hora, nombre, facturado
FROM dunasoft.planinc
WHERE nombre ILIKE '%Joanella%'
ORDER BY fecha DESC LIMIT 10;

\echo '=== PHONE MATCH other customers ==='
SELECT id, name, phone, phone_mobile, company_id FROM customers
WHERE regexp_replace(COALESCE(phone,'') || COALESCE(phone_mobile,''), '[^0-9]', '', 'g') LIKE '%642757330%';
