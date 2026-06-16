-- Modo prueba WA: el chat del teléfono de prueba no debe auto-vincularse a leads de marketing
-- (todos los envíos automáticos van al mismo número, p. ej. 667435503).

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
  v_is_test  boolean := false;
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

  v_digits := public.whatsapp_extract_phone_digits(p_chat_id);
  IF v_digits IS NULL OR length(v_digits) < 6 THEN
    RETURN;
  END IF;
  v_suffix := right(v_digits, 9);

  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_automation_settings s
    WHERE s.company_id = p_company_id
      AND s.test_mode_enabled = true
      AND right(regexp_replace(coalesce(s.test_phone, '667435503'), '[^0-9]', '', 'g'), 9) = v_suffix
  ) INTO v_is_test;

  SELECT c.customer_id, c.marketing_lead_id
  INTO v_current
  FROM public.whatsapp_chats c
  WHERE c.company_id = p_company_id AND c.chat_id = p_chat_id;

  IF v_current.customer_id IS NOT NULL THEN
    RETURN QUERY SELECT v_current.customer_id, v_current.marketing_lead_id;
    RETURN;
  END IF;

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

  IF v_customer IS NULL AND v_current.marketing_lead_id IS NULL AND NOT v_is_test THEN
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

  IF v_customer IS NOT NULL OR (v_lead IS NOT NULL AND NOT v_is_test) THEN
    UPDATE public.whatsapp_chats
    SET
      customer_id       = COALESCE(v_customer, customer_id),
      marketing_lead_id = CASE
        WHEN v_is_test THEN marketing_lead_id
        ELSE COALESCE(v_lead, marketing_lead_id)
      END
    WHERE company_id = p_company_id AND chat_id = p_chat_id;
  END IF;

  RETURN QUERY
  SELECT COALESCE(v_customer, v_current.customer_id),
         CASE WHEN v_is_test THEN v_current.marketing_lead_id ELSE COALESCE(v_lead, v_current.marketing_lead_id) END;
END;
$$;

-- Desvincular leads mezclados en el chat de prueba
UPDATE public.whatsapp_chats w
SET marketing_lead_id = NULL,
    updated_at = now()
FROM public.whatsapp_automation_settings s
WHERE w.company_id = s.company_id
  AND s.test_mode_enabled = true
  AND right(public.whatsapp_extract_phone_digits(w.chat_id), 9)
      = right(regexp_replace(coalesce(s.test_phone, '667435503'), '[^0-9]', '', 'g'), 9)
  AND w.marketing_lead_id IS NOT NULL;
