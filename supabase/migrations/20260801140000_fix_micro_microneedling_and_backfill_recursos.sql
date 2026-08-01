-- MICRO = micropigmentación (Style). Microneedling es recurso aparte.
-- Deshace el merge incorrecto Microneedling → MICRO.

-- 1) Reactivar Microneedling y quitarle keywords de MICRO
UPDATE public.recursos SET
  activo = true,
  match_keywords = 'microneedling,micro needling,needling',
  color = coalesce(nullif(btrim(color), ''), '#F59E0B'),
  updated_at = now()
WHERE id = 'e213e024-7227-4595-ac76-c61629a38d0e'::uuid;

-- 2) MICRO (Style): keywords de micropigmentación, sin microneedling
UPDATE public.recursos SET
  match_keywords = 'micro,micropigmentacion,micropigmentación,pigmentacion,pigmentación,cejas,labios,eyeliner,eye liner',
  updated_at = now()
WHERE id = 'a6399800-5ca2-4339-8047-af68418c472b'::uuid;

-- 3) Devolver artículo Peeling+Microneedling a Microneedling
UPDATE public.articles SET
  recurso_id = 'e213e024-7227-4595-ac76-c61629a38d0e'::uuid
WHERE recurso_id = 'a6399800-5ca2-4339-8047-af68418c472b'::uuid
  AND (
    lower(descripcion) LIKE '%microneedling%'
    OR lower(coalesce(codigo, '')) LIKE '%microneed%'
    OR codigo = 'LEG-0027'
  );

-- 4) Fusionar recurso Suite "Micropigmentación" (manual) → MICRO Style
SELECT public.merge_recurso_into(
  'a6399800-5ca2-4339-8047-af68418c472b'::uuid, -- MICRO Style
  '3d7896a5-efaa-4fb9-a559-4d7736683cec'::uuid, -- Micropigmentación manual
  'micropigmentacion,micropigmentación,pigmentacion'
);

-- 5) Backfill: items sin recurso_id pero cita con legacy_codrec → asignar recurso Style
UPDATE public.appointment_items ai
SET recurso_id = public.resolve_agenda_recurso_for_dunasoft_codrec(ap.company_id, ap.legacy_codrec)
FROM public.agenda_appointments ap
WHERE ai.appointment_id = ap.id
  AND ai.recurso_id IS NULL
  AND coalesce(ai.occupies_time, true)
  AND nullif(btrim(coalesce(ap.legacy_codrec, '')), '') IS NOT NULL
  AND public.resolve_agenda_recurso_for_dunasoft_codrec(ap.company_id, ap.legacy_codrec) IS NOT NULL;
