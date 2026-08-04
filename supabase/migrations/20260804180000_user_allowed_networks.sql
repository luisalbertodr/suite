-- Redes (CIDR) desde las que un usuario puede acceder a Suite.
-- Sin filas = sin restricción (compatibilidad con usuarios actuales).
-- Con una o más filas = la IP del cliente debe estar contenida en al menos un CIDR.

CREATE TABLE IF NOT EXISTS public.user_allowed_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cidr cidr NOT NULL,
  label text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_allowed_networks_user_cidr_unique UNIQUE (user_id, cidr)
);

CREATE INDEX IF NOT EXISTS idx_user_allowed_networks_user
  ON public.user_allowed_networks (user_id);

COMMENT ON TABLE public.user_allowed_networks IS
  'CIDRs permitidos por usuario. Vacío = acceso desde cualquier IP. Con filas = solo esas redes.';

ALTER TABLE public.user_allowed_networks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_user_networks(p_target_user_id uuid)
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

GRANT EXECUTE ON FUNCTION public.can_manage_user_networks(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS uan_select_self_or_admin ON public.user_allowed_networks;
CREATE POLICY uan_select_self_or_admin
  ON public.user_allowed_networks
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_user_networks(user_id)
  );

DROP POLICY IF EXISTS uan_insert_admin ON public.user_allowed_networks;
CREATE POLICY uan_insert_admin
  ON public.user_allowed_networks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_user_networks(user_id));

DROP POLICY IF EXISTS uan_update_admin ON public.user_allowed_networks;
CREATE POLICY uan_update_admin
  ON public.user_allowed_networks
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_user_networks(user_id))
  WITH CHECK (public.can_manage_user_networks(user_id));

DROP POLICY IF EXISTS uan_delete_admin ON public.user_allowed_networks;
CREATE POLICY uan_delete_admin
  ON public.user_allowed_networks
  FOR DELETE
  TO authenticated
  USING (public.can_manage_user_networks(user_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_allowed_networks TO authenticated;
GRANT ALL ON public.user_allowed_networks TO service_role;

-- Normaliza texto de IP (quita puerto, corchetes IPv6, espacios).
CREATE OR REPLACE FUNCTION public.normalize_client_ip(p_ip text)
RETURNS inet
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF p_ip IS NULL THEN
    RETURN NULL;
  END IF;
  v := btrim(p_ip);
  IF v = '' THEN
    RETURN NULL;
  END IF;

  -- "1.2.3.4:5678" (proxy raro) → quitar puerto si es IPv4:port
  IF v ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+$' THEN
    v := split_part(v, ':', 1);
  END IF;

  -- "[2001:db8::1]:443" o "2001:db8::1"
  IF left(v, 1) = '[' THEN
    v := substring(v FROM 2 FOR position(']' IN v) - 2);
  END IF;

  BEGIN
    RETURN v::inet;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_client_ip(text) TO authenticated, service_role;

-- true si el usuario no tiene redes configuradas, o si p_ip cae en alguna.
CREATE OR REPLACE FUNCTION public.user_client_ip_allowed(p_user_id uuid, p_ip text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip inet;
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.user_allowed_networks
  WHERE user_id = p_user_id;

  -- Sin restricciones configuradas → permitir
  IF v_count = 0 THEN
    RETURN true;
  END IF;

  v_ip := public.normalize_client_ip(p_ip);
  IF v_ip IS NULL THEN
    -- Hay restricción pero no pudimos leer la IP → denegar
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_allowed_networks n
    WHERE n.user_id = p_user_id
      AND v_ip <<= n.cidr
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_client_ip_allowed(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.user_client_ip_allowed(uuid, text) IS
  'Comprueba si p_ip está permitida para el usuario. Sin filas en user_allowed_networks = permitir.';
