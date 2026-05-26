-- Un lead activo por empresa y teléfono (últimos 9 dígitos).
-- Fusiona duplicados existentes y aplica índice único parcial (no archivados).

CREATE OR REPLACE FUNCTION public.marketing_lead_phone_norm(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN length(regexp_replace(COALESCE(p, ''), '\D', '', 'g')) >= 9
      THEN right(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), 9)
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.marketing_lead_phone_norm(text) IS
  'Últimos 9 dígitos del teléfono del lead; NULL si no hay número suficiente.';

DROP INDEX IF EXISTS public.marketing_leads_company_phone_norm_uidx;

ALTER TABLE public.marketing_leads
  DROP COLUMN IF EXISTS phone_norm;

ALTER TABLE public.marketing_leads
  ADD COLUMN phone_norm text
  GENERATED ALWAYS AS (public.marketing_lead_phone_norm(phone)) STORED;

COMMENT ON COLUMN public.marketing_leads.phone_norm IS
  'Generado: deduplicación de leads por teléfono (9 dígitos finales).';

CREATE TEMP TABLE _marketing_lead_phone_dup_map (
  loser_id uuid NOT NULL PRIMARY KEY,
  winner_id uuid NOT NULL
) ON COMMIT DROP;

WITH dup_groups AS (
  SELECT
    company_id,
    phone_norm,
    (array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC))[1] AS winner_id
  FROM public.marketing_leads
  WHERE phone_norm IS NOT NULL
    AND archived_at IS NULL
  GROUP BY company_id, phone_norm
  HAVING count(*) > 1
)
INSERT INTO _marketing_lead_phone_dup_map (loser_id, winner_id)
SELECT c.id AS loser_id, dg.winner_id
FROM public.marketing_leads c
JOIN dup_groups dg
  ON dg.company_id = c.company_id AND dg.phone_norm = c.phone_norm
WHERE c.id <> dg.winner_id
  AND c.archived_at IS NULL;

UPDATE public.marketing_lead_notes n
SET lead_id = m.winner_id
FROM _marketing_lead_phone_dup_map m
WHERE n.lead_id = m.loser_id;

UPDATE public.whatsapp_chats w
SET marketing_lead_id = m.winner_id
FROM _marketing_lead_phone_dup_map m
WHERE w.marketing_lead_id = m.loser_id
  AND w.marketing_lead_id IS DISTINCT FROM m.winner_id;

DELETE FROM public.marketing_leads c
USING _marketing_lead_phone_dup_map m
WHERE c.id = m.loser_id;

CREATE UNIQUE INDEX marketing_leads_company_phone_norm_uidx
  ON public.marketing_leads (company_id, phone_norm)
  WHERE phone_norm IS NOT NULL AND archived_at IS NULL;
