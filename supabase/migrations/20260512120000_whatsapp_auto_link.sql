-- ============================================================================
-- Auto-vinculación de chats de WhatsApp con clientes / leads de marketing
-- ----------------------------------------------------------------------------
-- Crea la función `whatsapp_auto_link_chat(company_id, chat_id)` que:
--   * Extrae los últimos 9 dígitos del chat_id (el "número" sin prefijo).
--   * Busca un único match en `customers.phone / phone_mobile / phone_home`.
--   * Si no encuentra cliente, prueba con `marketing_leads.phone`.
--   * Si encuentra exactamente uno y el chat todavía no tiene vinculación,
--     lo enlaza (customer_id o marketing_lead_id).
--
-- Se invoca desde las edge functions (webhook y proxy) con SECURITY DEFINER
-- para esquivar las RLS y operar de forma uniforme.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.whatsapp_extract_phone_digits(p_chat_id text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local text;
  v_digits text;
BEGIN
  IF p_chat_id IS NULL THEN RETURN NULL; END IF;
  -- "34666777888@c.us" → "34666777888"
  v_local := split_part(p_chat_id, '@', 1);
  v_digits := regexp_replace(coalesce(v_local, ''), '[^0-9]', '', 'g');
  IF v_digits IS NULL OR length(v_digits) = 0 THEN RETURN NULL; END IF;
  RETURN v_digits;
END;
$$;

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
  v_digits   text;
  v_suffix   text;
  v_customer uuid;
  v_lead     uuid;
  v_current  RECORD;
  v_count    int;
BEGIN
  IF p_company_id IS NULL OR p_chat_id IS NULL THEN
    RETURN;
  END IF;

  -- Si el chat es de grupo (xxx@g.us) no intentamos auto-vincular: no hay
  -- un solo número que mapear a un cliente.
  IF p_chat_id ~* '@g\.us$' THEN
    SELECT c.customer_id, c.marketing_lead_id
    INTO v_current
    FROM public.whatsapp_chats c
    WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;
    RETURN QUERY SELECT v_current.customer_id, v_current.marketing_lead_id;
    RETURN;
  END IF;

  v_digits := public.whatsapp_extract_phone_digits(p_chat_id);
  IF v_digits IS NULL OR length(v_digits) < 6 THEN
    RETURN;
  END IF;
  v_suffix := right(v_digits, 9);

  -- Estado actual de vinculación de este chat
  SELECT c.customer_id, c.marketing_lead_id
  INTO v_current
  FROM public.whatsapp_chats c
  WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;

  -- Si ya tiene cliente vinculado no tocamos nada (preferimos respetar lo
  -- que un humano haya enlazado a mano).
  IF v_current.customer_id IS NOT NULL THEN
    RETURN QUERY SELECT v_current.customer_id, v_current.marketing_lead_id;
    RETURN;
  END IF;

  -- 1) Match exacto con clientes
  SELECT count(*) INTO v_count FROM (
    SELECT id FROM public.customers
    WHERE company_id = p_company_id
      AND (
        regexp_replace(coalesce(phone, ''),        '[^0-9]', '', 'g') LIKE '%' || v_suffix
        OR regexp_replace(coalesce(phone_mobile, ''), '[^0-9]', '', 'g') LIKE '%' || v_suffix
        OR regexp_replace(coalesce(phone_home, ''),   '[^0-9]', '', 'g') LIKE '%' || v_suffix
      )
    LIMIT 2
  ) s;
  IF v_count = 1 THEN
    SELECT id INTO v_customer FROM public.customers
    WHERE company_id = p_company_id
      AND (
        regexp_replace(coalesce(phone, ''),        '[^0-9]', '', 'g') LIKE '%' || v_suffix
        OR regexp_replace(coalesce(phone_mobile, ''), '[^0-9]', '', 'g') LIKE '%' || v_suffix
        OR regexp_replace(coalesce(phone_home, ''),   '[^0-9]', '', 'g') LIKE '%' || v_suffix
      )
    LIMIT 1;
  END IF;

  -- 2) Si no hay cliente y tampoco lead actual, probamos con leads
  IF v_customer IS NULL AND v_current.marketing_lead_id IS NULL THEN
    SELECT count(*) INTO v_count FROM (
      SELECT id FROM public.marketing_leads
      WHERE company_id = p_company_id
        AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_suffix
      LIMIT 2
    ) s;
    IF v_count = 1 THEN
      SELECT id INTO v_lead FROM public.marketing_leads
      WHERE company_id = p_company_id
        AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_suffix
      LIMIT 1;
    END IF;
  END IF;

  -- Aplicar si hay algo que vincular
  IF v_customer IS NOT NULL OR v_lead IS NOT NULL THEN
    UPDATE public.whatsapp_chats
    SET
      customer_id       = COALESCE(v_customer, customer_id),
      marketing_lead_id = COALESCE(v_lead,     marketing_lead_id)
    WHERE company_id = p_company_id AND chat_id = p_chat_id;
  END IF;

  RETURN QUERY
  SELECT COALESCE(v_customer, v_current.customer_id),
         COALESCE(v_lead,     v_current.marketing_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_extract_phone_digits(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_auto_link_chat(uuid, text)
  TO authenticated, service_role;
