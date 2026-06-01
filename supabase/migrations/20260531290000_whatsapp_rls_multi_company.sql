-- WhatsApp RLS: acceso multi-empresa (user_can_access_company)

DROP POLICY IF EXISTS "whatsapp_config_company_access" ON public.whatsapp_config;
CREATE POLICY "whatsapp_config_company_access"
  ON public.whatsapp_config FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

DROP POLICY IF EXISTS "whatsapp_chats_company_access" ON public.whatsapp_chats;
CREATE POLICY "whatsapp_chats_company_access"
  ON public.whatsapp_chats FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

DROP POLICY IF EXISTS "whatsapp_messages_company_access" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_company_access"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));
