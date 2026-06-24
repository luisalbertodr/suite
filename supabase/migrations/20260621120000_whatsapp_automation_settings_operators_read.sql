-- Permite leer ajustes de automatización WA a operadores (WhatsApp / Marketing).
-- La escritura sigue restringida a administradores (política whatsapp_automation_settings_admin).

DROP POLICY IF EXISTS whatsapp_automation_settings_operators_read ON public.whatsapp_automation_settings;

CREATE POLICY whatsapp_automation_settings_operators_read ON public.whatsapp_automation_settings
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.current_user_has_marketing_permission('read')
    OR EXISTS (
      SELECT 1
      FROM public.get_effective_user_permissions(auth.uid(), company_id) ep
      WHERE (ep.resource = 'whatsapp' AND ep.action IN ('read', 'write'))
         OR (ep.resource = 'marketing' AND ep.action IN ('read', 'write'))
    )
  );

COMMENT ON POLICY whatsapp_automation_settings_operators_read ON public.whatsapp_automation_settings IS
  'Operadores WA/Marketing pueden leer (p. ej. modo prueba en chat); solo admin modifica.';
