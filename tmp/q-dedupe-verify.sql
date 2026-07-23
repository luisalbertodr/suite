SELECT count(*) AS medicina_dup_groups_left
FROM (
  SELECT customer_id, fecha
  FROM historial_clinico
  WHERE observaciones LIKE '%Fichas medicina.csv%'
  GROUP BY customer_id, fecha
  HAVING count(*) > 1
) x;

-- Mismo día con motivos distintos (legítimos) — Conchi
SELECT h.fecha, left(h.motivo_consulta, 50), count(*)
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE c.name ILIKE '%Conchi Garcia Dabrio%'
GROUP BY 1, 2
ORDER BY 1;
