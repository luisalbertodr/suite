-- Marketing RLS: permitir acceso multi-empresa / centro laboral (user_can_access_company)
-- Corrige 403 al sembrar etapas/campos cuando company_id activo ≠ get_user_company_id() estricto.

DROP POLICY IF EXISTS "marketing_lead_stages_company_access" ON public.marketing_lead_stages;
CREATE POLICY "marketing_lead_stages_company_access"
  ON public.marketing_lead_stages FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

DROP POLICY IF EXISTS "marketing_leads_company_access" ON public.marketing_leads;
CREATE POLICY "marketing_leads_company_access"
  ON public.marketing_leads FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

DROP POLICY IF EXISTS "marketing_field_config_company_access" ON public.marketing_field_config;
CREATE POLICY "marketing_field_config_company_access"
  ON public.marketing_field_config FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

DROP POLICY IF EXISTS "marketing_lead_notes_company_access" ON public.marketing_lead_notes;
CREATE POLICY "marketing_lead_notes_company_access"
  ON public.marketing_lead_notes FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

-- Backfill etapas por defecto en empresas que aún no las tienen
INSERT INTO public.marketing_lead_stages (company_id, name, position, color, is_default_intake, is_won)
SELECT c.id, st.name, st.position, st.color, st.is_default_intake, st.is_won
FROM public.companies c
CROSS JOIN (VALUES
  ('Nuevo Formulario',              0, '#22c55e', true,  false),
  ('Formulario+Agenda ficticia',    1, '#3b82f6', false, false),
  ('¡Aún no te ha escuchado!',      2, '#f59e0b', false, false),
  ('¡Llamar por la mañana!',        3, '#06b6d4', false, false),
  ('¡Llamar por la tarde!',         4, '#0ea5e9', false, false),
  ('Contactar más adelante',        5, '#a855f7', false, false),
  ('Cita Confirmada (Sin pago)',    6, '#10b981', false, true)
) AS st(name, position, color, is_default_intake, is_won)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_lead_stages s WHERE s.company_id = c.id
)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO public.marketing_field_config (
  company_id, field_key, display_label, visible_in_card, visible_in_detail,
  sort_order, field_type, is_system
)
SELECT c.id, f.field_key, f.display_label, f.visible_in_card, f.visible_in_detail,
       f.sort_order, f.field_type, true
FROM public.companies c
CROSS JOIN (VALUES
  ('value',         'Valor del cliente',     true,  true, 0, 'currency'),
  ('phone',         'Teléfono del contacto', true,  true, 1, 'phone'),
  ('first_name',    'Contacto',              true,  true, 2, 'string'),
  ('created_at',    'Creado el',             true,  true, 3, 'datetime'),
  ('email',         'Email',                 false, true, 4, 'email'),
  ('form_name',     'Formulario',            false, true, 5, 'string'),
  ('source',        'Origen',                false, true, 6, 'string')
) AS f(field_key, display_label, visible_in_card, visible_in_detail, sort_order, field_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_field_config fc WHERE fc.company_id = c.id
)
ON CONFLICT (company_id, field_key) DO NOTHING;
