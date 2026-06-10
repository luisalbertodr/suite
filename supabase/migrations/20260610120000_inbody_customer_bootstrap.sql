-- Nombre de cliente legacy por DNI (Lookin'Body / InBody import).
CREATE OR REPLACE FUNCTION public.legacy_customer_display_name(p_dni text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, legacy
AS $$
  SELECT nullif(trim(concat_ws(' ', nullif(trim(nomcli), ''), nullif(trim(ape1cli), ''))), '')
  FROM legacy.clientes
  WHERE nullif(btrim(dnicli), '') IS NOT NULL
    AND (
      lower(regexp_replace(dnicli, '[\s\-.]', '', 'g'))
        = lower(regexp_replace(coalesce(p_dni, ''), '[\s\-.]', '', 'g'))
      OR regexp_replace(dnicli, '\D', '', 'g') = regexp_replace(coalesce(p_dni, ''), '\D', '', 'g')
    )
  ORDER BY length(trim(concat_ws(' ', nomcli, ape1cli))) DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.legacy_customer_display_name(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.legacy_customer_display_name(text) IS
  'Devuelve nombre+apellidos legacy.clientes para un DNI/NIE (InBody import).';
