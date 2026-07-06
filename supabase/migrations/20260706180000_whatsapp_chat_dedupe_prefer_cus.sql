-- Consolida chats duplicados @lid + @c.us (mismo contacto) y corrige vínculos erróneos cliente↔chat.

CREATE OR REPLACE FUNCTION public.merge_whatsapp_chats(
  p_company_id uuid,
  p_target_chat_id text,
  p_source_chat_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.whatsapp_chats%ROWTYPE;
  tgt public.whatsapp_chats%ROWTYPE;
  use_src_preview boolean;
BEGIN
  IF p_target_chat_id IS NULL OR p_source_chat_id IS NULL THEN
    RETURN;
  END IF;
  IF p_target_chat_id = p_source_chat_id THEN
    RETURN;
  END IF;

  SELECT * INTO src
  FROM public.whatsapp_chats
  WHERE company_id = p_company_id AND chat_id = p_source_chat_id;

  IF NOT FOUND THEN
    UPDATE public.whatsapp_messages
    SET chat_id = p_target_chat_id
    WHERE company_id = p_company_id AND chat_id = p_source_chat_id;
    RETURN;
  END IF;

  SELECT * INTO tgt
  FROM public.whatsapp_chats
  WHERE company_id = p_company_id AND chat_id = p_target_chat_id;

  UPDATE public.whatsapp_messages
  SET chat_id = p_target_chat_id
  WHERE company_id = p_company_id AND chat_id = p_source_chat_id;

  IF tgt.id IS NOT NULL THEN
    use_src_preview := coalesce(src.last_message_at, src.created_at)
      >= coalesce(tgt.last_message_at, tgt.created_at);
    UPDATE public.whatsapp_chats SET
      name = coalesce(nullif(btrim(tgt.name), ''), src.name),
      customer_id = coalesce(tgt.customer_id, src.customer_id),
      marketing_lead_id = coalesce(tgt.marketing_lead_id, src.marketing_lead_id),
      profile_picture_url = coalesce(tgt.profile_picture_url, src.profile_picture_url),
      unread_count = coalesce(tgt.unread_count, 0) + coalesce(src.unread_count, 0),
      last_message_preview = CASE WHEN use_src_preview
        THEN coalesce(src.last_message_preview, tgt.last_message_preview)
        ELSE coalesce(tgt.last_message_preview, src.last_message_preview) END,
      last_message_at = CASE WHEN use_src_preview
        THEN coalesce(src.last_message_at, tgt.last_message_at)
        ELSE coalesce(tgt.last_message_at, src.last_message_at) END,
      last_message_from_me = CASE WHEN use_src_preview
        THEN src.last_message_from_me ELSE tgt.last_message_from_me END,
      history_synced_at = coalesce(tgt.history_synced_at, src.history_synced_at),
      oldest_message_at = CASE
        WHEN tgt.oldest_message_at IS NULL THEN src.oldest_message_at
        WHEN src.oldest_message_at IS NULL THEN tgt.oldest_message_at
        ELSE least(tgt.oldest_message_at, src.oldest_message_at)
      END,
      updated_at = now()
    WHERE id = tgt.id;
    DELETE FROM public.whatsapp_chats WHERE id = src.id;
  ELSE
    UPDATE public.whatsapp_chats
    SET chat_id = p_target_chat_id, updated_at = now()
    WHERE id = src.id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.merge_whatsapp_chats(uuid, text, text) IS
  'Fusiona source→target: mensajes y metadatos del chat WhatsApp (dedupe @lid en @c.us).';

-- Desvincular cliente si el teléfono del nombre del chat no coincide con el del cliente.
UPDATE public.whatsapp_chats wc
SET customer_id = NULL, updated_at = now()
FROM public.customers c
WHERE wc.customer_id = c.id
  AND wc.company_id = c.company_id
  AND length(regexp_replace(coalesce(wc.name, ''), '[^0-9]', '', 'g')) >= 9
  AND length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')) >= 8
  AND right(regexp_replace(wc.name, '[^0-9]', '', 'g'), 9)
    <> right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 9);

-- Raquel Lema Mira: Natalia Cañas Gende estaba mal vinculada al cliente Raquel.
UPDATE public.whatsapp_chats
SET customer_id = NULL, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND customer_id = '4c874083-7be0-40b1-af9d-15c22f6eb07b'::uuid
  AND chat_id IN ('100300438388766@lid', '155469846966413@lid');

UPDATE public.whatsapp_chats
SET customer_id = '055e59f1-4f2e-4e08-b289-0be3a9958936'::uuid, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND chat_id IN ('34600454590@c.us', '100300438388766@lid');

-- Dedupe: mismo nombre legible @lid + @c.us → conservar @c.us
DO $$
DECLARE
  r record;
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid;
BEGIN
  FOR r IN
    SELECT a.chat_id AS lid_id, b.chat_id AS cus_id
    FROM public.whatsapp_chats a
    JOIN public.whatsapp_chats b
      ON a.company_id = b.company_id
     AND a.company_id = v_company
     AND a.chat_id LIKE '%@lid'
     AND b.chat_id LIKE '%@c.us'
     AND a.chat_id <> b.chat_id
     AND lower(btrim(a.name)) = lower(btrim(b.name))
     AND btrim(coalesce(a.name, '')) <> ''
     AND a.name NOT LIKE '+%'
     AND length(btrim(a.name)) > 3
  LOOP
    PERFORM public.merge_whatsapp_chats(v_company, r.cus_id, r.lid_id);
  END LOOP;

  -- Mismo teléfono en nombre LID (+34…) y JID @c.us
  FOR r IN
    SELECT a.chat_id AS lid_id, b.chat_id AS cus_id
    FROM public.whatsapp_chats a
    JOIN public.whatsapp_chats b
      ON a.company_id = b.company_id
     AND a.company_id = v_company
     AND a.chat_id LIKE '%@lid'
     AND b.chat_id LIKE '%@c.us'
     AND a.name LIKE '+%'
     AND length(regexp_replace(a.name, '[^0-9]', '', 'g')) >= 9
     AND right(regexp_replace(a.name, '[^0-9]', '', 'g'), 9)
       = right(split_part(b.chat_id, '@', 1), 9)
  LOOP
    PERFORM public.merge_whatsapp_chats(v_company, r.cus_id, r.lid_id);
  END LOOP;

  -- Mismo customer_id: fusionar @lid en @c.us si existe par
  FOR r IN
    SELECT
      max(CASE WHEN chat_id LIKE '%@c.us' THEN chat_id END) AS cus_id,
      max(CASE WHEN chat_id LIKE '%@lid' THEN chat_id END) AS lid_id
    FROM public.whatsapp_chats
    WHERE company_id = v_company
      AND customer_id IS NOT NULL
    GROUP BY customer_id
    HAVING count(*) > 1
       AND max(CASE WHEN chat_id LIKE '%@c.us' THEN chat_id END) IS NOT NULL
       AND max(CASE WHEN chat_id LIKE '%@lid' THEN chat_id END) IS NOT NULL
  LOOP
    PERFORM public.merge_whatsapp_chats(v_company, r.cus_id, r.lid_id);
  END LOOP;
END;
$$;
