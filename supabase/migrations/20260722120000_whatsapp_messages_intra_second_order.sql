-- Desempate intra-segundo: el proveedor solo da timestamps a segundos.
-- Reparte milisegundos según created_at (orden de inserción) solo en filas
-- que aún tienen .000 ms, para no pisar precisión ya guardada en vivo.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, chat_id, date_trunc('second', "timestamp")
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) - 1 AS seq
  FROM public.whatsapp_messages
)
UPDATE public.whatsapp_messages m
SET "timestamp" = date_trunc('second', m."timestamp")
  + (ranked.seq * INTERVAL '1 millisecond')
FROM ranked
WHERE m.id = ranked.id
  AND ranked.seq > 0
  AND date_trunc('second', m."timestamp") = m."timestamp";
