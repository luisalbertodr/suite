-- María del Mar Lamas Pernas — consultas 13/12/2025
SELECT c.id, c.legacy_codcli, c.name, c.company_id
FROM customers c
WHERE c.name ILIKE '%Lamas%Pernas%'
   OR c.name ILIKE '%Mar Lamas%'
   OR c.legacy_codcli IN ('000330', '10000068', '330');

SELECT h.id, h.customer_id, h.appointment_id, h.fecha_consulta,
       left(coalesce(h.motivo,''), 80) AS motivo,
       left(coalesce(h.tratamiento,''), 80) AS tratamiento,
       left(coalesce(h.antecedentes_personales,''), 80) AS ap,
       h.created_at,
       h.metadata
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE (c.name ILIKE '%Lamas%Pernas%' OR c.legacy_codcli IN ('000330', '10000068', '330'))
  AND h.fecha_consulta::date = DATE '2025-12-13'
ORDER BY h.created_at, h.id;

-- Todas las consultas de este cliente (conteo por fecha)
SELECT h.fecha_consulta::date AS dia, count(*) AS n,
       array_agg(h.id::text ORDER BY h.created_at) AS ids
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE c.name ILIKE '%Lamas%Pernas%'
   OR c.legacy_codcli IN ('000330', '10000068')
GROUP BY 1
HAVING count(*) > 1
ORDER BY 1;
