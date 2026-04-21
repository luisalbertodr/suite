-- Código de seguimiento Dunasoft (IDPLAN): una cita visible por empresa + legacy_idplan.
-- Las filas de historial en legacy.planinc comparten idplan; la app usa solo la última versión al promocionar.

ALTER TABLE public.agenda_appointments ADD COLUMN IF NOT EXISTS legacy_idplan TEXT;

DELETE FROM public.agenda_appointments a
WHERE a.legacy_idplan IS NOT NULL
  AND a.legacy_idplan <> ''
  AND a.id IN (
    SELECT id FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY company_id, legacy_idplan
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        ) AS rn
      FROM public.agenda_appointments
      WHERE legacy_idplan IS NOT NULL AND legacy_idplan <> ''
    ) t
    WHERE rn > 1
  );

DROP INDEX IF EXISTS public.agenda_appointments_company_legacy_idplan_uidx;

CREATE UNIQUE INDEX agenda_appointments_company_legacy_idplan_uidx
  ON public.agenda_appointments (company_id, legacy_idplan)
  WHERE legacy_idplan IS NOT NULL AND legacy_idplan <> '';
