-- Corrige citas enlazadas por error a fichas "Paciente InBody …" (importación báscula).
-- Prioridad: legacy_codcli Style → nombre exacto de client_name → desvincular si no hay ficha real.

-- 1) Por código legacy Style (codcli)
UPDATE public.agenda_appointments AS a
SET
  customer_id = real_c.id,
  updated_at = now()
FROM public.customers AS wrong_c,
     public.customers AS real_c
WHERE a.customer_id = wrong_c.id
  AND wrong_c.name ~* '^paciente[[:space:]]+in[[:space:]]*body'
  AND real_c.company_id = a.company_id
  AND real_c.archived_at IS NULL
  AND NOT (real_c.name ~* '^paciente[[:space:]]+in[[:space:]]*body')
  AND a.legacy_codcli IS NOT NULL
  AND btrim(a.legacy_codcli) <> ''
  AND (
    btrim(real_c.legacy_codcli) = btrim(a.legacy_codcli)
    OR ltrim(btrim(real_c.legacy_codcli), '0') = ltrim(btrim(a.legacy_codcli), '0')
  )
  AND real_c.id IS DISTINCT FROM wrong_c.id;

-- 2) Por nombre de cliente en la cita (client_name)
UPDATE public.agenda_appointments AS a
SET
  customer_id = real_c.id,
  updated_at = now()
FROM public.customers AS wrong_c,
     public.customers AS real_c
WHERE a.customer_id = wrong_c.id
  AND wrong_c.name ~* '^paciente[[:space:]]+in[[:space:]]*body'
  AND real_c.company_id = a.company_id
  AND real_c.archived_at IS NULL
  AND NOT (real_c.name ~* '^paciente[[:space:]]+in[[:space:]]*body')
  AND NULLIF(btrim(a.client_name), '') IS NOT NULL
  AND lower(btrim(real_c.name)) = lower(btrim(a.client_name))
  AND real_c.id IS DISTINCT FROM wrong_c.id;

-- 3) Sin ficha real: quitar enlace erróneo (la UI sigue mostrando client_name de Style)
UPDATE public.agenda_appointments AS a
SET
  customer_id = NULL,
  updated_at = now()
FROM public.customers AS wrong_c
WHERE a.customer_id = wrong_c.id
  AND wrong_c.name ~* '^paciente[[:space:]]+in[[:space:]]*body'
  AND NOT EXISTS (
    SELECT 1
    FROM public.customers AS real_c
    WHERE real_c.company_id = a.company_id
      AND real_c.archived_at IS NULL
      AND NOT (real_c.name ~* '^paciente[[:space:]]+in[[:space:]]*body')
      AND (
        (
          NULLIF(btrim(a.legacy_codcli), '') IS NOT NULL
          AND (
            btrim(real_c.legacy_codcli) = btrim(a.legacy_codcli)
            OR ltrim(btrim(real_c.legacy_codcli), '0') = ltrim(btrim(a.legacy_codcli), '0')
          )
        )
        OR (
          NULLIF(btrim(a.client_name), '') IS NOT NULL
          AND lower(btrim(real_c.name)) = lower(btrim(a.client_name))
        )
      )
  );
