-- Limpieza de historial estético para citas:
-- 1) corrige fechas nulas/remotas (que luego se muestran como 1970),
-- 2) elimina duplicados por appointment_id manteniendo el más reciente,
-- 3) añade índice único parcial para prevenir nuevos duplicados de cita.

-- 1) Normalizar fechas inválidas/remotas en eventos de tipo cita.
UPDATE public.customer_aesthetic_history h
SET event_date = COALESCE(h.created_at, NOW())
WHERE h.event_type = 'appointment'
  AND (
    h.event_date IS NULL
    OR h.event_date < TIMESTAMPTZ '2000-01-01 00:00:00+00'
  );

-- 2) Eliminar duplicados por (company_id, customer_id, appointment_id) conservando el más reciente.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        company_id,
        customer_id,
        (data->>'appointment_id')
      ORDER BY
        COALESCE(event_date, created_at) DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.customer_aesthetic_history
  WHERE event_type = 'appointment'
    AND COALESCE(data->>'appointment_id', '') <> ''
)
DELETE FROM public.customer_aesthetic_history h
USING ranked r
WHERE h.id = r.id
  AND r.rn > 1;

-- 3) Evitar duplicados futuros (solo cuando appointment_id existe en data).
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_history_unique_appointment_event
ON public.customer_aesthetic_history (
  company_id,
  customer_id,
  (data->>'appointment_id')
)
WHERE event_type = 'appointment'
  AND COALESCE(data->>'appointment_id', '') <> '';
