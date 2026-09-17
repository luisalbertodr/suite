-- Preferencias de apariencia por usuario: tema + gestión por admins
-- (para asignar color de sidebar desde Configuración → Usuarios).

ALTER TABLE public.user_appearance_preferences
  ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'light';

COMMENT ON COLUMN public.user_appearance_preferences.theme IS
  'Tema de interfaz del usuario: light | dark | system';

CREATE OR REPLACE FUNCTION public.can_manage_user_appearance(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.current_user_is_superuser()
      OR public.user_has_effective_permission(auth.uid(), 'users', 'update')
      OR EXISTS (
        SELECT 1
        FROM public.user_company_roles ucr
        WHERE ucr.user_id = p_target_user_id
          AND public.is_company_admin(ucr.company_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.user_id = p_target_user_id
          AND up.company_id IS NOT NULL
          AND public.is_company_admin(up.company_id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_user_appearance(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view their own appearance preferences"
  ON public.user_appearance_preferences;
DROP POLICY IF EXISTS "Users can create their own appearance preferences"
  ON public.user_appearance_preferences;
DROP POLICY IF EXISTS "Users can update their own appearance preferences"
  ON public.user_appearance_preferences;
DROP POLICY IF EXISTS uap_select_self_or_admin ON public.user_appearance_preferences;
DROP POLICY IF EXISTS uap_insert_self_or_admin ON public.user_appearance_preferences;
DROP POLICY IF EXISTS uap_update_self_or_admin ON public.user_appearance_preferences;

CREATE POLICY uap_select_self_or_admin
  ON public.user_appearance_preferences
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_user_appearance(user_id)
  );

CREATE POLICY uap_insert_self_or_admin
  ON public.user_appearance_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.can_manage_user_appearance(user_id)
  );

CREATE POLICY uap_update_self_or_admin
  ON public.user_appearance_preferences
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_user_appearance(user_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.can_manage_user_appearance(user_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.user_appearance_preferences TO authenticated;
GRANT ALL ON public.user_appearance_preferences TO service_role;
