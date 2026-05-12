-- =============================================================================
-- Fase 1 del plan "Admin usuarios permisos":
--   1) Tabla user_permission_overrides para excepciones explícitas allow/deny
--      por usuario (precedencia DENY sobre ALLOW).
--   2) RPC get_effective_user_permissions(p_user_id) que combina:
--        - permisos heredados del rol base (user_company_roles + role_permissions)
--        - permisos legados ALLOW en user_permissions (compatibilidad)
--        - overrides ALLOW en user_permission_overrides
--        - overrides DENY en user_permission_overrides (los quita)
--   3) Triggers de auditoría sobre tablas sensibles de RBAC y vínculo
--      empleado-usuario (insert/update/delete -> public.audit_events).
--   4) RLS: solo admins de la empresa pueden gestionar overrides; cada
--      usuario puede leer los suyos propios.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabla user_permission_overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  resource text,
  action text,
  mode text NOT NULL CHECK (mode IN ('allow', 'deny')),
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_overrides_has_target CHECK (
    permission_id IS NOT NULL OR (resource IS NOT NULL AND action IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_upo_user_perm
  ON public.user_permission_overrides(company_id, user_id, permission_id)
  WHERE permission_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_upo_user_resaction
  ON public.user_permission_overrides(company_id, user_id, resource, action)
  WHERE permission_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_upo_user ON public.user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_upo_company ON public.user_permission_overrides(company_id);
CREATE INDEX IF NOT EXISTS idx_upo_mode ON public.user_permission_overrides(mode);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Helper: el usuario actual es admin de la empresa (rol "admin" en user_company_roles)?
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    WHERE ucr.user_id = auth.uid()
      AND ucr.company_id = p_company_id
      AND lower(r.name) = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS upo_select_self_or_admin ON public.user_permission_overrides;
CREATE POLICY upo_select_self_or_admin
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  );

DROP POLICY IF EXISTS upo_modify_admin ON public.user_permission_overrides;
CREATE POLICY upo_modify_admin
  ON public.user_permission_overrides
  FOR ALL
  TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- Trigger para updated_at
DROP TRIGGER IF EXISTS tr_upo_updated_at ON public.user_permission_overrides;
CREATE TRIGGER tr_upo_updated_at
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_permission_overrides IS
  'Excepciones explícitas por usuario sobre el rol base. DENY tiene precedencia sobre ALLOW.';

-- ---------------------------------------------------------------------------
-- 2) RPC get_effective_user_permissions
-- ---------------------------------------------------------------------------
-- Combina rol + ALLOW (user_permissions y overrides allow) - DENY (overrides deny).
-- Devuelve filas (permission_id, permission_name, resource, action) ya filtradas.
CREATE OR REPLACE FUNCTION public.get_effective_user_permissions(p_user_id uuid)
RETURNS TABLE (
  permission_id uuid,
  permission_name text,
  resource text,
  action text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  SELECT company_id INTO v_company
  FROM public.user_profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  RETURN QUERY
  WITH role_perms AS (
    -- Permisos del rol del usuario en su empresa.
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.permissions p
    JOIN public.role_permissions rp ON rp.permission_id = p.id
    JOIN public.user_company_roles ucr ON ucr.role_id = rp.role_id
    WHERE ucr.user_id = p_user_id
      AND (v_company IS NULL OR ucr.company_id = v_company)
  ),
  legacy_allow AS (
    -- Compatibilidad: user_permissions actúa como ALLOW por usuario.
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.permissions p
    JOIN public.user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = p_user_id
      AND (v_company IS NULL OR up.company_id = v_company)
  ),
  allow_overrides AS (
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.user_permission_overrides upo
    JOIN public.permissions p
      ON (upo.permission_id IS NOT NULL AND p.id = upo.permission_id)
      OR (upo.permission_id IS NULL AND p.resource = upo.resource AND p.action = upo.action)
    WHERE upo.user_id = p_user_id
      AND upo.mode = 'allow'
      AND (v_company IS NULL OR upo.company_id = v_company)
  ),
  deny_overrides AS (
    SELECT DISTINCT p.id
    FROM public.user_permission_overrides upo
    JOIN public.permissions p
      ON (upo.permission_id IS NOT NULL AND p.id = upo.permission_id)
      OR (upo.permission_id IS NULL AND p.resource = upo.resource AND p.action = upo.action)
    WHERE upo.user_id = p_user_id
      AND upo.mode = 'deny'
      AND (v_company IS NULL OR upo.company_id = v_company)
  ),
  union_allow AS (
    SELECT * FROM role_perms
    UNION
    SELECT * FROM legacy_allow
    UNION
    SELECT * FROM allow_overrides
  )
  SELECT ua.id, ua.name, ua.resource, ua.action
  FROM union_allow ua
  WHERE ua.id NOT IN (SELECT id FROM deny_overrides);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_user_permissions(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_effective_user_permissions(uuid) IS
  'Permisos efectivos = rol + ALLOW (user_permissions y overrides) - DENY (overrides). DENY siempre gana.';

-- Helper booleano cómodo desde SQL/UI.
CREATE OR REPLACE FUNCTION public.user_has_effective_permission(
  p_user_id uuid, p_resource text, p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_effective_user_permissions(p_user_id) ep
    WHERE ep.resource = p_resource AND ep.action = p_action
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_effective_permission(uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Triggers de auditoría en tablas de RBAC y vínculo empleado-usuario
-- ---------------------------------------------------------------------------
-- Las tablas user_company_roles, user_permissions y user_profiles no
-- necesariamente tienen columna company_id directamente accesible en
-- todos los entornos. Creamos un trigger especial que infiere el
-- company_id cuando es posible y, si no, lo deja NULL (la auditoría es
-- mejor que nada para estos eventos críticos).
CREATE OR REPLACE FUNCTION public.audit_log_rbac_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_company uuid;
  v_entity_id text;
  v_old jsonb;
  v_new jsonb;
  v_target_user uuid;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(row_to_json(OLD));
    v_entity_id := COALESCE(v_old ->> 'id', NULL);
    v_target_user := NULLIF(v_old ->> 'user_id', '')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(row_to_json(NEW));
    v_entity_id := COALESCE(v_new ->> 'id', NULL);
    v_target_user := NULLIF(v_new ->> 'user_id', '')::uuid;
  ELSE
    v_old := to_jsonb(row_to_json(OLD));
    v_new := to_jsonb(row_to_json(NEW));
    v_entity_id := COALESCE(v_new ->> 'id', v_old ->> 'id');
    v_target_user := NULLIF(COALESCE(v_new ->> 'user_id', v_old ->> 'user_id'), '')::uuid;
  END IF;

  -- Resolver company_id desde la propia fila, si no, desde user_profiles del target user.
  v_company := NULLIF(COALESCE(
    v_new ->> 'company_id',
    v_old ->> 'company_id'
  ), '')::uuid;

  IF v_company IS NULL AND v_target_user IS NOT NULL THEN
    SELECT company_id INTO v_company
    FROM public.user_profiles
    WHERE user_id = v_target_user
    LIMIT 1;
  END IF;

  IF v_company IS NULL AND v_actor IS NOT NULL THEN
    SELECT company_id INTO v_company
    FROM public.user_profiles
    WHERE user_id = v_actor
    LIMIT 1;
  END IF;

  -- Si seguimos sin company, no insertamos para no violar NOT NULL.
  IF v_company IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  INSERT INTO public.audit_events (
    company_id, actor_user_id, action, entity_schema, entity_table, entity_id,
    old_record, new_record, metadata
  ) VALUES (
    v_company,
    v_actor,
    CASE TG_OP
      WHEN 'INSERT' THEN 'insert'
      WHEN 'UPDATE' THEN 'update'
      ELSE 'delete'
    END,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    v_entity_id,
    v_old,
    v_new,
    jsonb_build_object(
      'source', 'trigger-rbac',
      'target_user_id', v_target_user
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

COMMENT ON FUNCTION public.audit_log_rbac_row_change() IS
  'Auditoría específica para tablas de RBAC/vínculo de usuarios. Infiere company_id si la tabla no lo tiene.';

DROP TRIGGER IF EXISTS tr_audit_user_company_roles ON public.user_company_roles;
CREATE TRIGGER tr_audit_user_company_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_company_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_rbac_row_change();

DROP TRIGGER IF EXISTS tr_audit_user_permissions ON public.user_permissions;
CREATE TRIGGER tr_audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_rbac_row_change();

DROP TRIGGER IF EXISTS tr_audit_user_permission_overrides ON public.user_permission_overrides;
CREATE TRIGGER tr_audit_user_permission_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_rbac_row_change();

DROP TRIGGER IF EXISTS tr_audit_user_profiles ON public.user_profiles;
CREATE TRIGGER tr_audit_user_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_rbac_row_change();

GRANT SELECT ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;

-- ---------------------------------------------------------------------------
-- 3.bis) Auto-detección de superusuario para sesiones Supabase Auth.
--
-- Caso real: un usuario que es superusuario (registrado en public.superusers)
-- entra por el login normal de Supabase Auth. Antes de este helper, perdía
-- todos los permisos porque `isSuperuser` se evaluaba solo desde localStorage
-- (flujo /superuser-login). Esta RPC permite al frontend marcar al usuario
-- como superuser automáticamente si su email coincide con un superuser activo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_is_superuser()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid() LIMIT 1;
  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.superusers
    WHERE lower(email) = lower(v_email)
      AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_superuser()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.current_user_is_superuser() IS
  'Devuelve true si el auth.user actual tiene su email en public.superusers (activo). Permite unificar el flujo de superuser con el login normal de Supabase Auth.';

-- ---------------------------------------------------------------------------
-- 4) Triggers de auditoría operativa adicionales
--    Estas tablas tienen company_id e id propios, así que reutilizamos el
--    trigger genérico audit_log_row_change (ya creado en la migración base).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sales'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tr_audit_sales ON public.sales';
    EXECUTE 'CREATE TRIGGER tr_audit_sales
      AFTER INSERT OR UPDATE OR DELETE ON public.sales
      FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change()';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tr_audit_notifications ON public.notifications';
    EXECUTE 'CREATE TRIGGER tr_audit_notifications
      AFTER INSERT OR UPDATE OR DELETE ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change()';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'marketing_leads'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS tr_audit_marketing_leads ON public.marketing_leads';
    EXECUTE 'CREATE TRIGGER tr_audit_marketing_leads
      AFTER INSERT OR UPDATE OR DELETE ON public.marketing_leads
      FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change()';
  END IF;
END
$$;
