-- Citas duplicadas: misma empresa + mismo legacy_planinc_id (reimportaciones / promote repetido).
-- 1) Elimina duplicados conservando la fila más reciente por (company_id, legacy_planinc_id).
-- 2) Índice único parcial para impedir que vuelva a ocurrir.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agenda_appointments'
      AND column_name = 'legacy_planinc_id'
  ) THEN
    ALTER TABLE public.agenda_appointments
      ADD COLUMN legacy_planinc_id BIGINT;
  END IF;
END $$;

DELETE FROM public.agenda_appointments a
WHERE a.legacy_planinc_id IS NOT NULL
  AND a.id IN (
    SELECT id FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY company_id, legacy_planinc_id
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        ) AS rn
      FROM public.agenda_appointments
      WHERE legacy_planinc_id IS NOT NULL
    ) t
    WHERE rn > 1
  );

DROP INDEX IF EXISTS public.agenda_appointments_company_legacy_planinc_uidx;

CREATE UNIQUE INDEX agenda_appointments_company_legacy_planinc_uidx
  ON public.agenda_appointments (company_id, legacy_planinc_id)
  WHERE legacy_planinc_id IS NOT NULL;
