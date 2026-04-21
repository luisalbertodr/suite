-- Horario del centro (JSON por día), teléfonos legacy cliente (tel1/tel2), horario empleados agenda.

-- Tel1 = posición «casa» en legacy; tel2 = móvil / línea destino SMS (si no SMS al móvil, el móvil puede ir en tel1 y SMS sigue yendo a tel2).
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_home text,
  ADD COLUMN IF NOT EXISTS phone_mobile text,
  ADD COLUMN IF NOT EXISTS legacy_codcli text;

CREATE INDEX IF NOT EXISTS idx_customers_company_legacy_codcli
  ON public.customers (company_id, legacy_codcli)
  WHERE legacy_codcli IS NOT NULL AND legacy_codcli <> '';

COMMENT ON COLUMN public.customers.phone_home IS 'Legacy tel1cli (casa; a veces móvil si el cliente no quiere SMS al móvil).';
COMMENT ON COLUMN public.customers.phone_mobile IS 'Legacy tel2cli (móvil o línea configurada para SMS).';
COMMENT ON COLUMN public.customers.legacy_codcli IS 'Código cliente Dunasoft (codcli) para cruzar con legacy.clientes.';

-- L-V 10:00–20:30, sáb 10:00–14:00, domingo cerrado. Claves "0".."6" (0=domingo).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS agenda_center_hours jsonb;

UPDATE public.companies
SET agenda_center_hours = COALESCE(agenda_center_hours, '{
  "0": [],
  "1": [{"open": "10:00", "close": "20:30"}],
  "2": [{"open": "10:00", "close": "20:30"}],
  "3": [{"open": "10:00", "close": "20:30"}],
  "4": [{"open": "10:00", "close": "20:30"}],
  "5": [{"open": "10:00", "close": "20:30"}],
  "6": [{"open": "10:00", "close": "14:00"}]
}'::jsonb)
WHERE agenda_center_hours IS NULL;

COMMENT ON COLUMN public.companies.agenda_center_hours IS 'Horario apertura centro por día de semana: array de {open,close} HH:mm; [] = cerrado.';

ALTER TABLE public.agenda_employees
  ADD COLUMN IF NOT EXISTS weekly_hours jsonb,
  ADD COLUMN IF NOT EXISTS unavailability jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.agenda_employees.weekly_hours IS 'Mismo esquema que companies.agenda_center_hours; NULL = usar solo horario del centro.';
COMMENT ON COLUMN public.agenda_employees.unavailability IS 'Excepciones: [{date:"YYYY-MM-DD",allDay?:true,start?:"HH:mm",end?:"HH:mm"}].';

UPDATE public.agenda_employees
SET unavailability = COALESCE(unavailability, '[]'::jsonb)
WHERE unavailability IS NULL;
