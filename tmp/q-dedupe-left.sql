SELECT c.name, h.fecha, count(*) AS n,
       array_agg(left(coalesce(h.motivo_consulta,''), 50) ORDER BY h.created_at) AS motivos,
       array_agg(left(coalesce(h.observaciones,''), 70) ORDER BY h.created_at) AS obs,
       array_agg(h.id::text ORDER BY h.created_at) AS ids
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE h.observaciones LIKE '%Fichas medicina.csv%'
GROUP BY c.name, h.fecha
HAVING count(*) > 1
ORDER BY h.fecha, c.name;
