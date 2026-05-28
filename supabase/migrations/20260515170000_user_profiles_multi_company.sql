-- Multi-empresa: permitir un perfil por (usuario, empresa), no uno solo por usuario.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_company_user_unique
  ON public.user_profiles(company_id, user_id);

COMMENT ON INDEX public.idx_user_profiles_company_user_unique IS
  'Un usuario puede tener un perfil distinto por cada empresa asignada.';
