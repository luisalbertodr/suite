-- Borra solo mensajes de OpenWA (mantiene historial WAHA). Recalcula previews de chat.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS source_provider TEXT;

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_source_provider_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_source_provider_check
  CHECK (source_provider IS NULL OR source_provider IN ('waha', 'openwa'));

COMMENT ON COLUMN public.whatsapp_messages.source_provider IS
  'Motor que originó el mensaje en BD: waha u openwa. NULL en filas legacy (se infiere de raw al purgar).';

CREATE OR REPLACE FUNCTION public.whatsapp_message_is_openwa(p_raw jsonb, p_source text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_source = 'openwa'
    OR (
      p_source IS NULL
      AND p_raw IS NOT NULL
      AND (
        (
          jsonb_typeof(p_raw->'id') = 'object'
          AND (p_raw->'id') ? '_serialized'
          AND COALESCE(p_raw->'id'->>'_serialized', '') <> ''
        )
        OR (
          NOT COALESCE((p_raw ? 'key') AND (p_raw->'key') ? 'remoteJid', false)
          AND NOT (p_raw ? '_data')
          AND NOT (p_raw ? 'message')
          AND (
            (p_raw ? 'waMessageId')
            OR p_raw->>'direction' IN ('outgoing', 'incoming')
            OR (p_raw ? 'contact')
            OR (
              (p_raw ? 'from')
              AND (p_raw ? 'fromMe')
              AND NOT (p_raw ? 'author')
              AND NOT (p_raw ? 'quotedMsg')
              AND (
                (p_raw ? 'hasMedia')
                OR (p_raw ? 'notifyName')
                OR (p_raw ? 'pushName')
              )
            )
          )
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_purge_openwa_data_internal(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages bigint;
  v_chats_removed bigint;
  v_chats_updated bigint;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id requerido';
  END IF;

  SELECT count(*)::bigint INTO v_messages
  FROM public.whatsapp_messages m
  WHERE m.company_id = p_company_id
    AND public.whatsapp_message_is_openwa(m.raw, m.source_provider);

  DELETE FROM public.whatsapp_messages m
  WHERE m.company_id = p_company_id
    AND public.whatsapp_message_is_openwa(m.raw, m.source_provider);

  WITH empty_chats AS (
    SELECT c.id
    FROM public.whatsapp_chats c
    WHERE c.company_id = p_company_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.whatsapp_messages m
        WHERE m.company_id = c.company_id
          AND m.chat_id = c.chat_id
      )
  ),
  del AS (
    DELETE FROM public.whatsapp_chats c
    WHERE c.id IN (SELECT id FROM empty_chats)
    RETURNING c.id
  )
  SELECT count(*)::bigint INTO v_chats_removed FROM del;

  WITH latest AS (
    SELECT DISTINCT ON (m.company_id, m.chat_id)
      m.company_id,
      m.chat_id,
      m.body,
      m.caption,
      m.type,
      m.from_me,
      m.timestamp
    FROM public.whatsapp_messages m
    WHERE m.company_id = p_company_id
    ORDER BY m.company_id, m.chat_id, m.timestamp DESC
  ),
  preview AS (
    SELECT
      l.company_id,
      l.chat_id,
      CASE
        WHEN COALESCE(trim(l.body), '') <> '' THEN trim(l.body)
        WHEN COALESCE(trim(l.caption), '') <> '' THEN trim(l.caption)
        WHEN lower(l.type) = 'image' THEN '[Imagen]'
        WHEN lower(l.type) IN ('video', 'ptv') THEN '[Vídeo]'
        WHEN lower(l.type) IN ('audio', 'ptt', 'voice') THEN '[Audio]'
        WHEN lower(l.type) = 'document' THEN '[Documento]'
        WHEN lower(l.type) = 'sticker' THEN '[Sticker]'
        ELSE '[Mensaje]'
      END AS last_message_preview,
      l.timestamp AS last_message_at,
      l.from_me AS last_message_from_me
    FROM latest l
  ),
  upd AS (
    UPDATE public.whatsapp_chats c
    SET
      last_message_preview = p.last_message_preview,
      last_message_at = p.last_message_at,
      last_message_from_me = p.last_message_from_me,
      updated_at = now()
    FROM preview p
    WHERE c.company_id = p.company_id
      AND c.chat_id = p.chat_id
    RETURNING c.id
  )
  SELECT count(*)::bigint INTO v_chats_updated FROM upd;

  UPDATE public.whatsapp_chats c
  SET
    history_synced_at = NULL,
    oldest_message_at = sub.oldest_message_at,
    updated_at = now()
  FROM (
    SELECT
      m.company_id,
      m.chat_id,
      min(m.timestamp) AS oldest_message_at
    FROM public.whatsapp_messages m
    WHERE m.company_id = p_company_id
    GROUP BY m.company_id, m.chat_id
  ) sub
  WHERE c.company_id = sub.company_id
    AND c.chat_id = sub.chat_id;

  RETURN jsonb_build_object(
    'ok', true,
    'messages_deleted', v_messages,
    'chats_removed', v_chats_removed,
    'chats_updated', v_chats_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_purge_openwa_data(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    p_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(p_company_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'No autorizado para limpiar mensajes OpenWA de esta empresa';
  END IF;

  RETURN public.whatsapp_purge_openwa_data_internal(p_company_id);
END;
$$;

COMMENT ON FUNCTION public.whatsapp_purge_openwa_data(uuid) IS
  'Elimina mensajes guardados por OpenWA y recalcula previews; conserva mensajes WAHA.';

COMMENT ON FUNCTION public.whatsapp_purge_openwa_data_internal(uuid) IS
  'Misma purga OpenWA sin comprobación RLS (edge function con service role).';

GRANT EXECUTE ON FUNCTION public.whatsapp_purge_openwa_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_purge_openwa_data_internal(uuid) TO service_role;
