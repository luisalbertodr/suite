-- Restaura whatsapp_auto_link_chat (phone_norm + @lid) y evita error cuando el chat no existe.
-- Mantiene: no vincular leads al teléfono de prueba WA.

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
  v_suffix              text;
  v_customer            uuid;
  v_lead                uuid;
  v_current_customer_id uuid;
  v_current_lead_id     uuid;
  v_count               int;
  v_is_test             boolean := false;
BEGIN
  IF p_company_id IS NULL OR p_chat_id IS NULL THEN
    RETURN;
  END IF;

  IF p_chat_id ~* '@broadcast$' OR lower(p_chat_id) = 'status@broadcast' THEN
    RETURN;
  END IF;

  IF p_chat_id ~* '@g\.us$' THEN
    SELECT c.customer_id, c.marketing_lead_id
    INTO v_current_customer_id, v_current_lead_id
    FROM public.whatsapp_chats c
    WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;
    RETURN QUERY SELECT v_current_customer_id, v_current_lead_id;
    RETURN;
  END IF;

  v_suffix := public.whatsapp_resolve_chat_phone_last9(p_company_id, p_chat_id);
  IF v_suffix IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_automation_settings s
    WHERE s.company_id = p_company_id
      AND s.test_mode_enabled = true
      AND right(regexp_replace(coalesce(s.test_phone, '667435503'), '[^0-9]', '', 'g'), 9) = v_suffix
  ) INTO v_is_test;

  SELECT c.customer_id, c.marketing_lead_id
  INTO v_current_customer_id, v_current_lead_id
  FROM public.whatsapp_chats c
  WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;

  IF v_current_customer_id IS NOT NULL THEN
    RETURN QUERY SELECT v_current_customer_id, v_current_lead_id;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.customers
  WHERE company_id = p_company_id AND phone_norm = v_suffix;

  IF v_count = 1 THEN
    SELECT id INTO v_customer
    FROM public.customers
    WHERE company_id = p_company_id AND phone_norm = v_suffix
    LIMIT 1;
  END IF;

  IF v_customer IS NULL AND v_current_lead_id IS NULL AND NOT v_is_test THEN
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

  IF v_customer IS NOT NULL OR (v_lead IS NOT NULL AND NOT v_is_test) THEN
    UPDATE public.whatsapp_chats AS wc
    SET
      customer_id       = COALESCE(v_customer, wc.customer_id),
      marketing_lead_id = CASE
        WHEN v_is_test THEN wc.marketing_lead_id
        ELSE COALESCE(v_lead, wc.marketing_lead_id)
      END
    WHERE wc.company_id = p_company_id AND wc.chat_id = p_chat_id;

    IF v_customer IS NOT NULL THEN
      UPDATE public.whatsapp_chats AS wc
      SET customer_id = v_customer
      WHERE wc.company_id = p_company_id
        AND wc.customer_id IS NULL
        AND NOT (wc.chat_id ~* '@g\.us$')
        AND NOT (wc.chat_id ~* '@broadcast$')
        AND public.whatsapp_resolve_chat_phone_last9(p_company_id, wc.chat_id) = v_suffix;
    END IF;
  END IF;

  RETURN QUERY
  SELECT COALESCE(v_customer, v_current_customer_id),
         CASE
           WHEN v_is_test THEN v_current_lead_id
           ELSE COALESCE(v_lead, v_current_lead_id)
         END;
END;
$$;
