-- Vincula citas con ficha de cliente (import Dunasoft: legacy_codcli → customers).

ALTER TABLE public.agenda_appointments
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_appointments_company_customer
  ON public.agenda_appointments (company_id, customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.agenda_appointments.customer_id IS
  'Cliente vinculado; se rellena desde legacy_codcli o al seleccionar en la agenda.';

-- Backfill por código legacy (exacto y sin ceros a la izquierda).
UPDATE public.agenda_appointments a
SET customer_id = c.id
FROM public.customers c
WHERE a.company_id = c.company_id
  AND a.customer_id IS NULL
  AND NULLIF(btrim(a.legacy_codcli), '') IS NOT NULL
  AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
  AND (
    btrim(a.legacy_codcli) = btrim(c.legacy_codcli)
    OR NULLIF(ltrim(btrim(a.legacy_codcli), '0'), '') = NULLIF(ltrim(btrim(c.legacy_codcli), '0'), '')
  );
