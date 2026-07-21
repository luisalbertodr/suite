-- Losers should be gone
SELECT legacy_codcli, name FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND ltrim(coalesce(legacy_codcli,''),'0') IN ('10000071','10000068','10000072','10000069','10000070','8142','330','8044','8088','4674','7331')
ORDER BY legacy_codcli;

-- Historiales Paqui/Cambon/Lamas/Antelo/Layla
SELECT c.legacy_codcli, c.name, count(h.*) AS historiales
FROM public.customers c
LEFT JOIN public.historial_clinico h ON h.customer_id = c.id
WHERE c.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND ltrim(coalesce(c.legacy_codcli,''),'0') IN ('8142','330','8044','8088','7331','10000069','10000070')
GROUP BY 1,2
ORDER BY 1;

-- Sample cleaned record
SELECT fecha::text, left(motivo_consulta,50) AS motivo, left(tratamiento,80) AS tto
FROM public.historial_clinico
WHERE id = 'b9163a3d-8039-4ffc-b45c-55a2db97d3ee';
