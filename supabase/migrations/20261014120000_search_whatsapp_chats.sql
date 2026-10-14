-- Búsqueda de chats WhatsApp alineada con search_customers (nombre/apellidos/teléfono)
-- y vinculación por phone_norm aunque customer_id aún no esté persistido.

CREATE OR REPLACE FUNCTION public.search_whatsapp_chats(
  p_company_id uuid,
  p_query text,
  p_limit int DEFAULT 80
)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  chat_id text,
  name text,
  is_group boolean,
  profile_picture_url text,
  last_message_preview text,
  last_message_at timestamptz,
  last_message_from_me boolean,
  unread_count integer,
  pinned boolean,
  archived boolean,
  history_synced_at timestamptz,
  oldest_message_at timestamptz,
  customer_id uuid,
  marketing_lead_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  matched_customer_id uuid,
  matched_customer_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms text[];
  v_limit int;
  v_first text;
  v_pattern text;
  v_digits text;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.user_can_access_company(p_company_id)
    OR public.is_admin()
  ) THEN
    RETURN;
  END IF;

  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 80), 120));
  v_terms := public.customer_search_terms(p_query);
  v_first := CASE WHEN cardinality(v_terms) > 0 THEN v_terms[1] ELSE NULL END;
  v_pattern := '%' || replace(replace(trim(coalesce(p_query, '')), '%', ''), '_', '') || '%';
  v_digits := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');

  IF (v_first IS NULL OR length(v_first) < 2)
     AND length(v_digits) < 3
     AND length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN;
  END IF;

  DROP TABLE IF EXISTS _wa_search_hits;
  CREATE TEMP TABLE _wa_search_hits (
    id uuid,
    company_id uuid,
    chat_id text,
    name text,
    is_group boolean,
    profile_picture_url text,
    last_message_preview text,
    last_message_at timestamptz,
    last_message_from_me boolean,
    unread_count integer,
    pinned boolean,
    archived boolean,
    history_synced_at timestamptz,
    oldest_message_at timestamptz,
    customer_id uuid,
    marketing_lead_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    matched_customer_id uuid,
    matched_customer_name text
  ) ON COMMIT DROP;

  INSERT INTO _wa_search_hits
  WITH matched_customers AS (
    SELECT
      c.id,
      c.name,
      c.phone_norm
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND v_first IS NOT NULL
      AND (
        public.customer_search_normalize(c.name) LIKE '%' || v_first || '%'
        OR public.customer_search_normalize(coalesce(c.email, '')) LIKE '%' || v_first || '%'
        OR lower(replace(coalesce(c.tax_id, ''), ' ', '')) LIKE '%' || v_first || '%'
        OR public.customer_search_normalize(coalesce(c.legacy_codcli, '')) LIKE '%' || v_first || '%'
        OR (
          v_first ~ '^\d+$'
          AND regexp_replace(
            concat_ws('', c.phone, c.phone_mobile, c.phone_home, c.tax_id, c.legacy_codcli),
            '\D',
            '',
            'g'
          ) LIKE '%' || v_first || '%'
        )
      )
      AND public.customer_matches_search_terms(
        c.name,
        c.email,
        c.tax_id,
        c.phone,
        c.phone_mobile,
        c.phone_home,
        coalesce(c.legacy_codcli, ''),
        v_terms
      )
    LIMIT 80
  ),
  unique_norms AS (
    SELECT phone_norm
    FROM matched_customers
    WHERE phone_norm IS NOT NULL
      AND length(phone_norm) = 9
    GROUP BY phone_norm
    HAVING count(*) = 1
  ),
  customer_by_norm AS (
    SELECT DISTINCT ON (mc.phone_norm)
      mc.phone_norm,
      mc.id AS customer_id,
      mc.name AS customer_name
    FROM matched_customers mc
    JOIN unique_norms un ON un.phone_norm = mc.phone_norm
    ORDER BY mc.phone_norm, mc.id
  ),
  matched_leads AS (
    SELECT l.id
    FROM public.marketing_leads l
    WHERE l.company_id = p_company_id
      AND l.archived_at IS NULL
      AND v_first IS NOT NULL
      AND (
        public.customer_search_normalize(coalesce(l.first_name, '')) LIKE '%' || v_first || '%'
        OR public.customer_search_normalize(coalesce(l.last_name, '')) LIKE '%' || v_first || '%'
        OR public.customer_search_normalize(
          concat_ws(' ', l.first_name, l.last_name)
        ) LIKE '%' || v_first || '%'
        OR (
          length(v_digits) >= 3
          AND regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        )
      )
    LIMIT 40
  ),
  phone_hits AS (
    SELECT j.chat_id, j.customer_id, j.customer_name
    FROM (
      SELECT
        wc.chat_id,
        cbn.customer_id,
        cbn.customer_name
      FROM public.whatsapp_chats wc
      JOIN customer_by_norm cbn
        ON right(
          regexp_replace(split_part(wc.chat_id, '@', 1), '[^0-9]', '', 'g'),
          9
        ) = cbn.phone_norm
      WHERE wc.company_id = p_company_id
        AND wc.archived = false
        AND wc.chat_id ~* '@(c\.us|s\.whatsapp\.net)$'
        AND NOT (wc.chat_id ~* '@broadcast$')
    ) j

    UNION

    SELECT l.chat_id, l.customer_id, l.customer_name
    FROM (
      SELECT DISTINCT ON (wc.chat_id)
        wc.chat_id,
        cbn.customer_id,
        cbn.customer_name
      FROM public.whatsapp_chats wc
      JOIN public.whatsapp_messages m
        ON m.company_id = wc.company_id
       AND m.chat_id = wc.chat_id
       AND m.from_me = false
      JOIN customer_by_norm cbn
        ON right(
          regexp_replace(split_part(m.from_jid, '@', 1), '[^0-9]', '', 'g'),
          9
        ) = cbn.phone_norm
      WHERE wc.company_id = p_company_id
        AND wc.archived = false
        AND wc.customer_id IS NULL
        AND wc.chat_id ~* '@lid$'
        AND m.from_jid ~* '@(c\.us|s\.whatsapp\.net)$'
      ORDER BY wc.chat_id, m.timestamp DESC
    ) l
  ),
  all_chat_ids AS (
    SELECT wc.chat_id
    FROM public.whatsapp_chats wc
    WHERE wc.company_id = p_company_id
      AND wc.archived = false
      AND length(trim(coalesce(p_query, ''))) >= 2
      AND (
        wc.name ILIKE v_pattern
        OR wc.chat_id ILIKE v_pattern
        OR wc.last_message_preview ILIKE v_pattern
        OR (
          length(v_digits) >= 3
          AND regexp_replace(wc.chat_id, '\D', '', 'g') LIKE '%' || v_digits || '%'
        )
      )

    UNION
    SELECT wc.chat_id
    FROM public.whatsapp_chats wc
    WHERE wc.company_id = p_company_id
      AND wc.archived = false
      AND wc.customer_id IN (SELECT mc.id FROM matched_customers mc)

    UNION
    SELECT wc.chat_id
    FROM public.whatsapp_chats wc
    WHERE wc.company_id = p_company_id
      AND wc.archived = false
      AND wc.marketing_lead_id IN (SELECT ml.id FROM matched_leads ml)

    UNION
    SELECT ph.chat_id FROM phone_hits ph
  )
  SELECT
    wc.id,
    wc.company_id,
    wc.chat_id,
    wc.name,
    wc.is_group,
    wc.profile_picture_url,
    wc.last_message_preview,
    wc.last_message_at,
    wc.last_message_from_me,
    wc.unread_count,
    wc.pinned,
    wc.archived,
    wc.history_synced_at,
    wc.oldest_message_at,
    COALESCE(wc.customer_id, ph.customer_id) AS customer_id,
    wc.marketing_lead_id,
    wc.created_at,
    wc.updated_at,
    COALESCE(wc.customer_id, ph.customer_id) AS matched_customer_id,
    COALESCE(
      (SELECT mc.name FROM matched_customers mc WHERE mc.id = wc.customer_id LIMIT 1),
      ph.customer_name
    ) AS matched_customer_name
  FROM all_chat_ids ids
  JOIN public.whatsapp_chats wc
    ON wc.company_id = p_company_id AND wc.chat_id = ids.chat_id
  LEFT JOIN phone_hits ph ON ph.chat_id = wc.chat_id
  WHERE NOT (
    lower(wc.chat_id) = 'status@broadcast'
    OR wc.chat_id ~* '@broadcast$'
  );

  -- Persistir vínculos únicos descubiertos por teléfono.
  UPDATE public.whatsapp_chats wc
  SET
    customer_id = h.matched_customer_id,
    updated_at = now()
  FROM _wa_search_hits h
  WHERE wc.company_id = p_company_id
    AND wc.chat_id = h.chat_id
    AND wc.customer_id IS NULL
    AND h.matched_customer_id IS NOT NULL;

  RETURN QUERY
  SELECT
    h.id,
    h.company_id,
    h.chat_id,
    h.name,
    h.is_group,
    h.profile_picture_url,
    h.last_message_preview,
    h.last_message_at,
    h.last_message_from_me,
    h.unread_count,
    h.pinned,
    h.archived,
    h.history_synced_at,
    h.oldest_message_at,
    h.customer_id,
    h.marketing_lead_id,
    h.created_at,
    h.updated_at,
    h.matched_customer_id,
    h.matched_customer_name
  FROM _wa_search_hits h
  ORDER BY
    CASE WHEN COALESCE(h.unread_count, 0) > 0 THEN 0 ELSE 1 END,
    h.last_message_at DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.search_whatsapp_chats(uuid, text, int) IS
  'Busca chats WhatsApp por nombre/teléfono CRM (misma lógica que search_customers), JID y preview; vincula customer_id por phone_norm único.';

GRANT EXECUTE ON FUNCTION public.search_whatsapp_chats(uuid, text, int)
  TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS whatsapp_chats_company_customer_id_idx
  ON public.whatsapp_chats (company_id, customer_id)
  WHERE customer_id IS NOT NULL AND archived = false;
