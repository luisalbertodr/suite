-- Elimina duplicados InBody por desfase exacto de 1h (import CSV naive UTC vs Madrid/MDB).
-- Conserva la fila con timestamp anterior (UTC correcto para hora de pared Madrid).

DELETE FROM public.inbody_measurements
WHERE id IN (
  SELECT CASE
    WHEN a.measured_at > b.measured_at THEN a.id
    ELSE b.id
  END
  FROM public.inbody_measurements a
  JOIN public.inbody_measurements b ON
    a.company_id = b.company_id
    AND a.id < b.id
    AND upper(regexp_replace(a.inbody_user_id, '[\s\-.]', '', 'g'))
      = upper(regexp_replace(b.inbody_user_id, '[\s\-.]', '', 'g'))
    AND abs(extract(epoch FROM (a.measured_at - b.measured_at))) BETWEEN 3599 AND 3601
    AND (
      a.weight_kg IS NOT DISTINCT FROM b.weight_kg
      OR (
        a.weight_kg IS NOT NULL
        AND b.weight_kg IS NOT NULL
        AND abs(a.weight_kg - b.weight_kg) < 0.1
      )
    )
);
