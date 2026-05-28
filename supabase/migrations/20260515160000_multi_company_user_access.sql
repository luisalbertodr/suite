-- Acceso multi-empresa / multi-centro laboral
-- Un usuario puede tener varias empresas asignadas (user_company_roles) y elegir
-- cuál está activa en sesión. Las empresas del mismo work_center son accesibles.

-- ---------------------------------------------------------------------------
-- 1. Empresa activa por usuario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_active_company (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_active_company ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uac_select_own ON public.user_active_company;
CREATE POLICY uac_select_own
  ON public.user_active_company FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS uac_upsert_own ON public.user_active_company;
CREATE POLICY uac_upsert_own
  ON public.user_active_company FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Helpers de acceso
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_assigned_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.company_id
  FROM (
    SELECT ucr.company_id
    FROM public.user_company_roles ucr
    WHERE ucr.user_id = auth.uid()
    UNION
    SELECT up.company_id
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.company_id IS NOT NULL
  ) s
  WHERE s.company_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_user_accessible_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH assigned AS (
    SELECT public.get_user_assigned_company_ids() AS id
  ),
  wc_siblings AS (
    SELECT DISTINCT c.id
    FROM public.companies c
    JOIN public.companies host ON host.id IN (SELECT id FROM assigned)
    WHERE host.work_center_id IS NOT NULL
      AND c.work_center_id = host.work_center_id
  )
  SELECT id FROM assigned
  UNION
  SELECT id FROM wc_siblings;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_company(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.get_user_accessible_company_ids() g
      WHERE g = target_company_id
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active UUID;
  v_fallback UUID;
BEGIN
  SELECT uac.company_id INTO v_active
  FROM public.user_active_company uac
  WHERE uac.user_id = auth.uid();

  IF v_active IS NOT NULL AND public.user_can_access_company(v_active) THEN
    RETURN v_active;
  END IF;

  SELECT up.company_id INTO v_fallback
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid()
    AND up.company_id IS NOT NULL
  ORDER BY up.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_fallback IS NOT NULL AND public.user_can_access_company(v_fallback) THEN
    RETURN v_fallback;
  END IF;

  SELECT ucr.company_id INTO v_fallback
  FROM public.user_company_roles ucr
  WHERE ucr.user_id = auth.uid()
  LIMIT 1;

  RETURN v_fallback;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_work_center_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.work_center_id
  FROM public.companies c
  WHERE c.id = public.get_user_company_id();
$$;

CREATE OR REPLACE FUNCTION public.company_in_user_work_center(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_company_id IS NULL THEN false
    WHEN target_company_id = public.get_user_company_id() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.companies host
      JOIN public.companies target ON target.id = target_company_id
      WHERE host.id = public.get_user_company_id()
        AND host.work_center_id IS NOT NULL
        AND host.work_center_id = target.work_center_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_work_center_billing_companies()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.companies c
  WHERE c.id = public.get_user_company_id()
     OR (
       public.get_user_work_center_id() IS NOT NULL
       AND c.work_center_id = public.get_user_work_center_id()
     );
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC: cambiar empresa activa + listar accesibles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_active_company_id(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'No tienes acceso a la empresa %', p_company_id;
  END IF;

  INSERT INTO public.user_active_company (user_id, company_id, updated_at)
  VALUES (auth.uid(), p_company_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        updated_at = now();

  RETURN p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_accessible_companies()
RETURNS TABLE (
  id UUID,
  name TEXT,
  short_name TEXT,
  tax_id TEXT,
  work_center_id UUID,
  work_center_name TEXT,
  is_assigned BOOLEAN,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.short_name,
    c.tax_id,
    c.work_center_id,
    wc.name AS work_center_name,
    (c.id IN (SELECT public.get_user_assigned_company_ids())) AS is_assigned,
    (c.id = public.get_user_company_id()) AS is_active
  FROM public.companies c
  LEFT JOIN public.work_centers wc ON wc.id = c.work_center_id
  WHERE c.id IN (SELECT public.get_user_accessible_company_ids())
  ORDER BY is_assigned DESC, wc.name NULLS LAST, c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_assigned_company_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_company_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_company(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_active_company_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_companies() TO authenticated, service_role;

-- Permisos efectivos según empresa activa (no la primera fila de user_profiles)
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
  v_company := public.get_user_company_id();

  RETURN QUERY
  WITH role_perms AS (
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.permissions p
    JOIN public.role_permissions rp ON rp.permission_id = p.id
    JOIN public.user_company_roles ucr ON ucr.role_id = rp.role_id
    WHERE ucr.user_id = p_user_id
      AND (v_company IS NULL OR ucr.company_id = v_company)
  ),
  legacy_allow AS (
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

-- Backfill empresa activa desde perfil existente
INSERT INTO public.user_active_company (user_id, company_id)
SELECT DISTINCT ON (up.user_id) up.user_id, up.company_id
FROM public.user_profiles up
WHERE up.company_id IS NOT NULL
ORDER BY up.user_id, up.updated_at DESC NULLS LAST
ON CONFLICT (user_id) DO NOTHING;

-- Ver roles propios en todas las empresas asignadas
DROP POLICY IF EXISTS "Users can view company roles" ON public.user_company_roles;
CREATE POLICY "Users can view company roles"
  ON public.user_company_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id = public.get_user_company_id()
  );

COMMENT ON TABLE public.user_active_company IS
  'Empresa operativa activa del usuario en sesión (multi-tenant switch).';
