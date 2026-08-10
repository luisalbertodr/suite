-- Solo vincular mediciones InBody a fichas existentes por DNI.
-- NO crea clientes "Paciente InBody" (las huérfanas se enlazan al completar tax_id).

WITH company AS (
  SELECT id FROM companies WHERE name ILIKE '%Mar%Lamas%' LIMIT 1
)
UPDATE inbody_measurements m
SET customer_id = cu.id, updated_at = now()
FROM customers cu, company c
WHERE m.company_id = c.id
  AND cu.company_id = c.id
  AND m.customer_id IS NULL
  AND nullif(btrim(m.inbody_user_id), '') IS NOT NULL
  AND nullif(btrim(cu.tax_id), '') IS NOT NULL
  AND NOT public.is_inbody_placeholder_customer_name(cu.name)
  AND public.normalize_inbody_dni_key(m.inbody_user_id) = ANY (public.inbody_dni_match_keys(cu.tax_id));
