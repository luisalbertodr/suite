SELECT h.id, h.customer_id, h.appointment_id, h.fecha,
       h.tipo, h.titulo,
       left(coalesce(h.motivo_consulta,''), 100) AS motivo,
       left(coalesce(h.tratamiento,''), 100) AS tto,
       left(coalesce(h.antecedentes_personales,''), 100) AS ap,
       left(coalesce(h.observaciones,''), 120) AS obs,
       h.created_at
FROM historial_clinico h
WHERE h.customer_id = 'f9b582ea-3e64-4284-ab1f-b550c40ef85c'
  AND h.fecha = DATE '2025-12-13'
ORDER BY h.created_at, h.id;

-- Duplicados por fecha para este cliente
SELECT h.fecha, count(*) AS n,
       array_agg(h.id::text ORDER BY h.created_at) AS ids,
       array_agg(left(coalesce(h.observaciones,''), 60) ORDER BY h.created_at) AS obs
FROM historial_clinico h
WHERE h.customer_id = 'f9b582ea-3e64-4284-ab1f-b550c40ef85c'
GROUP BY h.fecha
HAVING count(*) > 1
ORDER BY h.fecha;

-- Todas las consultas de Lamas
SELECT h.id, h.fecha, h.appointment_id IS NOT NULL AS has_appt,
       left(coalesce(h.titulo,''), 50) AS titulo,
       left(coalesce(h.observaciones,''), 80) AS obs,
       h.created_at
FROM historial_clinico h
WHERE h.customer_id = 'f9b582ea-3e64-4284-ab1f-b550c40ef85c'
ORDER BY h.fecha, h.created_at;
