-- Orden de columnas en la vista agenda (menor = más a la izquierda).
ALTER TABLE public.agenda_employees
  ADD COLUMN IF NOT EXISTS agenda_sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.agenda_employees.agenda_sort_order IS 'Orden en la cuadrícula de agenda (ascendente).';

-- Orden inicial estable por empresa (no altera active).
WITH ranked AS (
  SELECT
    id,
    (row_number() OVER (PARTITION BY company_id ORDER BY created_at ASC, name ASC) - 1)::integer AS ord
  FROM public.agenda_employees
)
UPDATE public.agenda_employees ae
SET agenda_sort_order = ranked.ord
FROM ranked
WHERE ae.id = ranked.id;
