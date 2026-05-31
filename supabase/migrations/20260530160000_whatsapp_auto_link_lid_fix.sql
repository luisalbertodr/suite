-- Mejora auto-vinculación: chats @lid no tienen teléfono en chat_id; lo resolvemos
-- desde from_jid / remoteJidAlt de mensajes y comparamos con customers.phone_norm.

CREATE OR REPLACE FUNCTION public.whatsapp_resolve_chat_phone_last9(
  p_company_id uuid,
  p_chat_id    text
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_last9  text;
  v_alt    text;
BEGIN
  IF p_company_id IS NULL OR p_chat_id IS NULL THEN RETURN NULL; END IF;
  IF p_chat_id ~* '@g\.us$' THEN RETURN NULL; END IF;

  -- JID con número real (@c.us / @s.whatsapp.net)
  IF p_chat_id ~* '@(c\.us|s\.whatsapp\.net)$' THEN
    v_digits := public.whatsapp_extract_phone_digits(p_chat_id);
    IF v_digits IS NOT NULL AND length(v_digits) >= 9 THEN
      RETURN right(v_digits, 9);
    END IF;
  END IF;

  -- Mensajes entrantes: from_jid suele traer el @c.us real en chats @lid
  SELECT regexp_replace(split_part(m.from_jid, '@', 1), '[^0-9]', '', 'g')
  INTO v_digits
  FROM public.whatsapp_messages m
  WHERE m.company_id = p_company_id
    AND m.chat_id = p_chat_id
    AND m.from_me = false
    AND m.from_jid ~* '@(c\.us|s\.whatsapp\.net)$'
  ORDER BY m.timestamp DESC
  LIMIT 1;
  IF v_digits IS NOT NULL AND length(v_digits) >= 9 THEN
    RETURN right(v_digits, 9);
  END IF;

  -- remoteJidAlt en el raw del mensaje (Baileys / NOWEB)
  SELECT public.whatsapp_extract_phone_digits(
    COALESCE(m.raw->'_data'->'key'->>'remoteJidAlt', m.raw->'key'->>'remoteJidAlt')
  )
  INTO v_alt
  FROM public.whatsapp_messages m
  WHERE m.company_id = p_company_id
    AND m.chat_id = p_chat_id
    AND COALESCE(
      m.raw->'_data'->'key'->>'remoteJidAlt',
      m.raw->'key'->>'remoteJidAlt'
    ) ~* '@(c\.us|s\.whatsapp\.net)$'
  ORDER BY m.timestamp DESC
  LIMIT 1;
  IF v_alt IS NOT NULL AND length(v_alt) >= 9 THEN
    RETURN right(v_alt, 9);
  END IF;

  -- Fallback: dígitos del chat_id solo si parecen teléfono (no LID interno largo)
  v_digits := public.whatsapp_extract_phone_digits(p_chat_id);
  IF v_digits IS NOT NULL AND length(v_digits) >= 9 AND length(v_digits) <= 13 THEN
    RETURN right(v_digits, 9);
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_resolve_chat_phone_last9(uuid, text)
  TO authenticated, service_role;

-- Reemplazo completo: CREATE OR REPLACE falla si el owner no es postgres
DROP FUNCTION IF EXISTS public.whatsapp_auto_link_chat(uuid, text);

CREATE OR REPLACE FUNCTION public.whatsapp_auto_link_chat(
  p_company_id uuid,
  p_chat_id    text
) RETURNS TABLE (
  customer_id        uuid,
  marketing_lead_id  uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suffix   text;
  v_customer uuid;
  v_lead     uuid;
  v_current  RECORD;
  v_count    int;
BEGIN
  IF p_company_id IS NULL OR p_chat_id IS NULL THEN
    RETURN;
  END IF;

  IF p_chat_id ~* '@g\.us$' THEN
    SELECT c.customer_id, c.marketing_lead_id
    INTO v_current
    FROM public.whatsapp_chats c
    WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;
    RETURN QUERY SELECT v_current.customer_id, v_current.marketing_lead_id;
    RETURN;
  END IF;

  v_suffix := public.whatsapp_resolve_chat_phone_last9(p_company_id, p_chat_id);
  IF v_suffix IS NULL THEN
    RETURN;
  END IF;

  SELECT c.customer_id, c.marketing_lead_id
  INTO v_current
  FROM public.whatsapp_chats c
  WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;

  IF v_current.customer_id IS NOT NULL THEN
    RETURN QUERY SELECT v_current.customer_id, v_current.marketing_lead_id;
    RETURN;
  END IF;

  -- Match único por phone_norm (clientes)
  SELECT count(*) INTO v_count
  FROM public.customers
  WHERE company_id = p_company_id AND phone_norm = v_suffix;

  IF v_count = 1 THEN
    SELECT id INTO v_customer
    FROM public.customers
    WHERE company_id = p_company_id AND phone_norm = v_suffix
    LIMIT 1;
  END IF;

  -- Leads si no hay cliente
  IF v_customer IS NULL AND v_current.marketing_lead_id IS NULL THEN
    SELECT count(*) INTO v_count
    FROM public.marketing_leads
    WHERE company_id = p_company_id
      AND phone_norm = v_suffix
      AND archived_at IS NULL;

    IF v_count = 1 THEN
      SELECT id INTO v_lead
      FROM public.marketing_leads
      WHERE company_id = p_company_id
        AND phone_norm = v_suffix
        AND archived_at IS NULL
      LIMIT 1;
    END IF;
  END IF;

  IF v_customer IS NOT NULL OR v_lead IS NOT NULL THEN
    UPDATE public.whatsapp_chats AS wc
    SET
      customer_id       = COALESCE(v_customer, wc.customer_id),
      marketing_lead_id = COALESCE(v_lead, wc.marketing_lead_id)
    WHERE wc.company_id = p_company_id AND wc.chat_id = p_chat_id;

    -- Propagar a otros chats del mismo teléfono (@lid / @c.us duplicados)
    IF v_customer IS NOT NULL THEN
      UPDATE public.whatsapp_chats AS wc
      SET customer_id = v_customer
      WHERE wc.company_id = p_company_id
        AND wc.customer_id IS NULL
        AND NOT (wc.chat_id ~* '@g\.us$')
        AND public.whatsapp_resolve_chat_phone_last9(p_company_id, wc.chat_id) = v_suffix;
    END IF;
  END IF;

  RETURN QUERY
  SELECT COALESCE(v_customer, v_current.customer_id),
         COALESCE(v_lead, v_current.marketing_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_auto_link_chat(uuid, text)
  TO authenticated, service_role;
