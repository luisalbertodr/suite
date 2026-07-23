SELECT c.name, h.fecha, count(*) AS n
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE c.name ILIKE '%Lamas%Pernas%'
GROUP BY 1, 2
ORDER BY 2;

SELECT h.id, h.fecha, left(h.motivo_consulta, 40), left(h.observaciones, 70)
FROM historial_clinico h
WHERE h.customer_id = 'f9b582ea-3e64-4284-ab1f-b550c40ef85c'
ORDER BY h.fecha;

-- Grupos restantes (legítimos: 2 visitas distintas el mismo día)
SELECT c.name, h.fecha, count(*) AS n,
       array_agg(left(coalesce(h.motivo_consulta,''), 45) ORDER BY h.created_at) AS motivos
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE h.observaciones LIKE '%Fichas medicina.csv%'
GROUP BY c.name, h.fecha
HAVING count(*) > 1
ORDER BY h.fecha, c.name;
